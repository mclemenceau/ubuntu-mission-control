import { todayStr, artifactTypeLabel, versionAgeDays, extractArch } from './utils.js'
import { fetchBuilds, fetchTestResults } from '../api/client.js'
import {
  extractBugs,
  latestExecutions,
  resolveResults,
  countEffective,
  parseTester,
  parseTestCase,
} from './testResults.js'

/**
 * Phase 1 — Filter today's artifacts and build the initial product list.
 * Returns a flat array of product objects (no test data yet).
 */
export function buildProductItems(artefacts, milestone) {
  const today = todayStr()

  return artefacts
    .filter(a => a.release === milestone.release)
    .map(a => ({
      id:          a.id,
      name:        a.name,
      release:     a.release,
      displayName: a.os || artifactTypeLabel(a.name, a.release),
      arch:        a.architecture || extractArch(a.name),
      type:        artifactTypeLabel(a.name, a.release),
      version:     a.version,
      status:      a.status ?? null,
      mandatory:   false,
      builtToday:  a.version?.startsWith(today) ?? false,
      ageDays:     versionAgeDays(a.version),
      tests:       { passed: 0, failed: 0, inProgress: 0, notStarted: 0 },
      bugs:        [],
      execIds:     [],
    }))
}

/**
 * Phase 2 — Enrich items in-place with test execution counts.
 * Re-run executions are superseded by the newest attempt per
 * (build, environment, test plan) and do not count.
 * Calls onProgress(done, total) after each item completes.
 */
export async function enrichWithTestExecutions(items, onProgress) {
  let done = 0
  await Promise.all(
    items.map(async item => {
      const builds = await fetchBuilds(item.id).catch(() => [])
      const execs = builds
        .flatMap(b => (b.test_executions ?? []).map(e => ({ ...e, buildId: b.id })))
        .filter(te => te.test_plan !== 'Image build')

      // Every attempt is kept so bugs filed against superseded runs are found.
      item.execIds = execs.map(e => e.id)
      item.execs = new Map(execs.map(e => [e.id, e]))

      const latest = latestExecutions(execs)
      item.tests = {
        passed:     latest.filter(e => e.status === 'PASSED').length,
        failed:     latest.filter(e => ['FAILED', 'ENDED_PREMATURELY'].includes(e.status)).length,
        inProgress: latest.filter(e => e.status === 'IN_PROGRESS').length,
        notStarted: latest.filter(e => ['NOT_STARTED', 'NOT_TESTED'].includes(e.status)).length,
      }
      onProgress?.(++done, items.length)
    }),
  )
}

/**
 * Fetch results for every execution of a product and resolve re-runs.
 * Results are cached for the session, so callers can repeat this freely.
 */
async function loadResolvedResults(item) {
  const execResults = await Promise.all(
    (item.execIds ?? []).map(async execId => {
      const exec = item.execs?.get(execId) ?? { id: execId }
      const results = await fetchTestResults(execId).catch(() => [])
      return { exec, buildId: exec.buildId, results }
    }),
  )
  const all = execResults.flatMap(({ results }) => results)
  return { ...resolveResults(execResults), all }
}

/**
 * Phase 3 — Enrich items in-place with LP bugs from test result comments,
 * and replace execution-level counts with counts of effective results
 * (the latest attempt of each test). Bugs are collected from every
 * attempt: a bug filed against a failed run stays real after a rerun.
 * Returns the total unique bug count.
 */
export async function enrichWithBugs(items, onProgress) {
  const globalBugs = new Set()
  let done = 0
  const total = items.length

  await Promise.all(
    items.map(async item => {
      const { effective, all } = await loadResolvedResults(item)

      const itemBugs = new Set(all.flatMap(extractBugs))
      itemBugs.forEach(b => globalBugs.add(b))
      item.bugs = [...itemBugs]

      const { passed, failed, recovered } = countEffective(effective)
      if (passed + failed > 0) {
        item.tests.passed = passed
        item.tests.failed = failed
      }
      item.tests.recovered = recovered
      // IN_PROGRESS executions are not actionable - only PASSED/FAILED matter.
      item.tests.inProgress = 0
      onProgress?.(++done, total)
    }),
  )

  return globalBugs.size
}

/**
 * Computes dashboard KPIs from the current product list.
 */
export function computeKpis(products) {
  const total      = products.length
  const todayCount = products.filter(p => p.builtToday).length
  const approved   = products.filter(p => p.status === 'APPROVED').length
  const appPct     = total > 0 ? Math.round((approved / total) * 100) : null

  const passed     = products.reduce((s, p) => s + p.tests.passed, 0)
  const failed     = products.reduce((s, p) => s + p.tests.failed, 0)
  const inProgress = products.reduce((s, p) => s + p.tests.inProgress, 0)
  const notStarted = products.reduce((s, p) => s + p.tests.notStarted, 0)
  const totalExecs = passed + failed + inProgress + notStarted
  const passRate   = (passed + failed) > 0
    ? Math.round((passed / (passed + failed)) * 100)
    : null

  const bugCount = new Set(products.flatMap(p => p.bugs)).size

  return {
    buildsToday: todayCount,
    approved:    { count: approved, total, pct: appPct },
    tests:       { total: totalExecs, passed, failed, inProgress },
    passRate:    { pct: passRate, passed, outOf: passed + failed },
    bugs:        bugCount,
  }
}

/**
 * Merges a freshly-fetched product list into the current displayed list.
 * Preserves object identity for unchanged items so Svelte skips re-rendering them.
 * Returns { products, changed }.
 */
export function diffProducts(current, next) {
  const byId = new Map(current.map(p => [p.id, p]))
  let changed = false
  const merged = []

  for (const item of next) {
    const prev = byId.get(item.id)

    if (!prev) {
      merged.push({ ...item, _changedAt: Date.now(), _changeKind: 'new' })
      changed = true
      continue
    }

    const statusChanged = item.status !== prev.status
    const testsChanged  = JSON.stringify(item.tests) !== JSON.stringify(prev.tests)
    const bugsChanged   = JSON.stringify([...item.bugs].sort()) !== JSON.stringify([...prev.bugs].sort())

    if (statusChanged || testsChanged || bugsChanged) {
      let _changeKind = 'tests'
      if (statusChanged) {
        _changeKind = item.status === 'APPROVED' ? 'approved'
                    : item.status === 'MARKED_AS_FAILED' ? 'failed' : 'status'
      }
      const _prev = { tests: { ...prev.tests }, bugs: [...prev.bugs], status: prev.status }
      merged.push({ ...prev, ...item, _changedAt: Date.now(), _changeKind, _prev })
      changed = true
    } else {
      // Strip stale change metadata so the next diff doesn't re-emit notifications
      if (prev._changeKind !== undefined) {
        const { _changeKind, _prev, _changedAt, ...clean } = prev
        merged.push(clean)
      } else {
        merged.push(prev)   // same reference — Svelte won't re-render this card
      }
    }
  }

  if (merged.length !== current.length) changed = true
  return { products: merged, changed }
}

// ── Test snapshot helpers ─────────────────────────────────────────────────

/**
 * Re-reads cached test results for all current products and aggregates them
 * into a snapshot matching exactly what the Test Executions KPI shows.
 * Only the latest attempt of each test counts; earlier attempts are
 * reported as reruns, and still contribute their bugs.
 *
 * Returns:
 *   summary    - { total, passed, failed, passRate, recovered, reruns }
 *   byArtifact - [{ displayName, arch, passed, failed, bugs, passRate }]
 *                sorted by pass rate asc
 *   byTester   - [{ tester, passed, failed, bugs, passRate }] sorted by
 *                total desc
 *   failures   - [{ displayName, arch, testCase, tester, comment }]
 */
export async function buildCurrentTestSnapshot(products) {
  const artMap     = new Map()   // key: `${displayName}|${arch}`
  const testerMap  = new Map()   // key: testerName
  const failures   = []
  let recovered = 0
  let reruns    = 0

  function testerRow(tester) {
    if (!testerMap.has(tester)) {
      testerMap.set(tester, {
        tester,
        passed: 0,
        failed: 0,
        manualTotal: 0,
        automatedTotal: 0,
        bugs: new Set(),
      })
    }
    return testerMap.get(tester)
  }

  await Promise.all(products.map(async product => {
    const { effective, superseded } = await loadResolvedResults(product)
    const artKey = `${product.displayName}|${product.arch}`

    if (!artMap.has(artKey)) {
      artMap.set(artKey, {
        displayName: product.displayName,
        arch:        product.arch,
        passed:      0,
        failed:      0,
        bugs:        new Set(),
      })
    }
    const art = artMap.get(artKey)
    reruns += superseded.length

    for (const { exec, result: r, recovered: rec } of effective) {
      const tester = parseTester(r.name)
      const t = testerRow(tester)

      if (r.status === 'PASSED') {
        art.passed++
        t.passed++
      } else if (r.status === 'FAILED') {
        art.failed++
        t.failed++
        failures.push({
          displayName: product.displayName,
          arch:        product.arch,
          testCase:    parseTestCase(r.name),
          tester,
          comment: r.comment ?? '',
        })
      }
      if (rec) recovered++
      if (exec.test_plan === 'Manual Testing') t.manualTotal++
      else t.automatedTotal++
    }

    for (const { result: r } of [...effective, ...superseded]) {
      const t = testerRow(parseTester(r.name))
      extractBugs(r).forEach(b => { art.bugs.add(b); t.bugs.add(b) })
    }
  }))

  // Finalize artifact rows
  const byArtifact = [...artMap.values()]
    .map(a => ({
      ...a,
      bugs:     a.bugs.size,
      passRate: (a.passed + a.failed) > 0
        ? Math.round((a.passed / (a.passed + a.failed)) * 100)
        : null,
    }))
    .sort((a, b) => {
      // Nulls (no results) go to the bottom
      if (a.passRate === null && b.passRate === null) return 0
      if (a.passRate === null) return 1
      if (b.passRate === null) return -1
      return a.passRate - b.passRate
    })

  // Finalize tester rows
  const byTester = [...testerMap.values()]
    .map(t => ({
      ...t,
      bugs:     t.bugs.size,
      total:    t.passed + t.failed,
      passRate: (t.passed + t.failed) > 0
        ? Math.round((t.passed / (t.passed + t.failed)) * 100)
        : null,
    }))
    .sort((a, b) => b.total - a.total)
  const totalPassed = byArtifact.reduce((s, a) => s + a.passed, 0)
  const totalFailed = byArtifact.reduce((s, a) => s + a.failed, 0)
  const summary = {
    passed:    totalPassed,
    failed:    totalFailed,
    total:     totalPassed + totalFailed,
    passRate:  (totalPassed + totalFailed) > 0
      ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100)
      : null,
    recovered,
    reruns,
  }

  return { summary, byArtifact, byTester, failures }
}
