import { todayStr, artifactTypeLabel, versionAgeDays, extractArch } from './utils.js'
import { fetchBuilds, fetchTestResults } from '../api/client.js'

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
      // Temporary accumulators populated in Phase 3 from individual test results.
      // Overwrite the coarser execution-level counts once real results are available.
      _resultPassed: 0,
      _resultFailed: 0,
      _execsWithResults: new Set(),
    }))
}

/**
 * Phase 2 — Enrich items in-place with test execution counts.
 * Calls onProgress(done, total) after each item completes.
 */
export async function enrichWithTestExecutions(items, onProgress) {
  let done = 0
  await Promise.all(
    items.map(async item => {
      const builds = await fetchBuilds(item.id).catch(() => [])
      const execs = builds
        .flatMap(b => b.test_executions ?? [])
        .filter(te => te.test_plan === 'Manual Testing')

      item.execIds = execs.map(e => e.id)
      item.tests = {
        passed:     execs.filter(e => e.status === 'PASSED').length,
        failed:     execs.filter(e => ['FAILED', 'ENDED_PREMATURELY'].includes(e.status)).length,
        inProgress: execs.filter(e => e.status === 'IN_PROGRESS').length,
        notStarted: execs.filter(e => ['NOT_STARTED', 'NOT_TESTED'].includes(e.status)).length,
      }
      onProgress?.(++done, items.length)
    }),
  )
}

/**
 * Phase 3 — Enrich items in-place with LP bugs from test result comments.
 * Deduplicates execution IDs across items to avoid redundant API calls.
 * Returns the total unique bug count.
 */
export async function enrichWithBugs(items, onProgress) {
  // Build a deduplicated list of (item, execId) pairs
  const seen = new Set()
  const queue = []
  for (const item of items) {
    for (const execId of item.execIds) {
      if (!seen.has(execId)) {
        seen.add(execId)
        queue.push({ item, execId })
      }
    }
  }

  const globalBugs = new Set()
  let done = 0

  await Promise.all(
    queue.map(async ({ item, execId }) => {
      const results = await fetchTestResults(execId).catch(() => [])
      const itemBugs = new Set()

      for (const r of results) {
        // Tally individual test result statuses (more accurate than execution-level status)
        if (r.status === 'PASSED') item._resultPassed++
        else if (r.status === 'FAILED') item._resultFailed++

        // Structured API issues
        for (const { issue } of r.issues ?? []) {
          if (issue?.source === 'launchpad' && issue?.key) {
            globalBugs.add(issue.key)
            itemBugs.add(issue.key)
          }
        }
        // Freeform comment patterns
        const comment = r.comment ?? ''
        for (const pat of [
          /bugs\.launchpad\.net\/[^\s)]+\/\+bug\/(\d+)/gi,
          /\bbug\s*#?(\d{5,7})\b/gi,
          /\bLP[:\s]+#?(\d{5,7})\b/gi,
        ]) {
          for (const m of comment.matchAll(pat)) {
            globalBugs.add(m[1])
            itemBugs.add(m[1])
          }
        }

        if (results.length > 0) item._execsWithResults.add(execId)
      }

      item.bugs = [...itemBugs]
      onProgress?.(++done, queue.length)
    }),
  )

  // Replace Phase 2 execution-level counts with actual submitted test results.
  // An execution that is IN_PROGRESS but has results is no longer "pending" —
  // it has real data. An execution with no results at all stays in inProgress.
  for (const item of items) {
    if (item._resultPassed + item._resultFailed > 0) {
      item.tests.passed = item._resultPassed
      item.tests.failed = item._resultFailed
      item.tests.inProgress = Math.max(
        0,
        item.tests.inProgress - item._execsWithResults.size,
      )
    }
    delete item._resultPassed
    delete item._resultFailed
    delete item._execsWithResults
  }

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
      merged.push(item)
      changed = true
      continue
    }

    const statusChanged = item.status !== prev.status
    const testsChanged  = JSON.stringify(item.tests) !== JSON.stringify(prev.tests)
    const bugsChanged   = JSON.stringify([...item.bugs].sort()) !== JSON.stringify([...prev.bugs].sort())

    if (statusChanged || testsChanged || bugsChanged) {
      merged.push({ ...prev, ...item })
      changed = true
    } else {
      merged.push(prev)   // same reference — Svelte won't re-render this card
    }
  }

  if (merged.length !== current.length) changed = true
  return { products: merged, changed }
}
