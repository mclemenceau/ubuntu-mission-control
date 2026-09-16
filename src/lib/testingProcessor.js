import { fetchArtefacts, fetchArtefactVersions, fetchBuilds, fetchTestResults } from '../api/client.js'
import { artifactTypeLabel, fmtDate } from './utils.js'

function parseTester(name) {
  const idx = (name || '').indexOf(' - ')
  return idx > 0 ? name.slice(0, idx).trim() : (name || '').trim()
}

function parseTestCase(name) {
  const idx = (name || '').indexOf(' - ')
  return idx > 0 ? name.slice(idx + 3).trim() : ''
}

function versionToDate(version) {
  const base = (version ?? '').slice(0, 8)
  if (!/^\d{8}$/.test(base)) return null
  return `${base.slice(0, 4)}-${base.slice(4, 6)}-${base.slice(6, 8)}`
}

function extractBugs(result) {
  const bugs = new Set()
  for (const { issue } of result.issues ?? []) {
    if (issue?.source === 'launchpad' && issue?.key) bugs.add(issue.key)
  }
  const comment = result.comment ?? ''
  for (const pat of [
    /bugs\.launchpad\.net\/[^\s)]+\/\+bug\/(\d+)/gi,
    /\bbug\s*#?(\d{5,7})\b/gi,
    /\bLP[:\s]+#?(\d{5,7})\b/gi,
  ]) {
    for (const m of comment.matchAll(pat)) bugs.add(m[1])
  }
  return [...bugs]
}

/**
 * 4-phase pipeline building a flat list of individual test result entries
 * for the given release and date range.
 * onProgress({ label, pct }) is called throughout.
 */
export async function buildTestingDataset({ release, dateFrom, dateTo }, onProgress) {
  // Phase 1 — fetch artifact list
  onProgress?.({ label: 'Loading artifacts…', pct: 2 })
  const allArtefacts = await fetchArtefacts('image')
  const artefacts = release ? allArtefacts.filter(a => a.release === release) : allArtefacts
  onProgress?.({ label: `${artefacts.length} artifacts found`, pct: 5 })

  // Phase 2 — fetch version history per artifact and filter to date range.
  // The API may omit the latest version from the history endpoint, so we
  // always inject the current artifact explicitly if its date is in range
  // (mirrors the same workaround in HistoryPanel.svelte loadFullHistory).
  let done = 0
  const versionData = await Promise.all(artefacts.map(async art => {
    try {
      const versions = await fetchArtefactVersions(art.id)
      const inRange = versions.filter(v => {
        const d = versionToDate(v.version)
        return d && d >= dateFrom && d <= dateTo
      })

      const currentDate = versionToDate(art.version)
      if (currentDate && currentDate >= dateFrom && currentDate <= dateTo) {
        const alreadyPresent = inRange.some(v => v.artefact_id === art.id)
        if (!alreadyPresent) {
          inRange.push({ version: art.version, artefact_id: art.id })
        }
      }

      onProgress?.({ label: 'Fetching version history…', pct: 5 + Math.round((++done / artefacts.length) * 20) })
      return { art, versions: inRange }
    } catch {
      onProgress?.({ label: 'Fetching version history…', pct: 5 + Math.round((++done / artefacts.length) * 20) })
      return { art, versions: [] }
    }
  }))

  // Flatten to (art, version) pairs that have builds to fetch.
  // Each version object from fetchArtefactVersions exposes `artefact_id` (not `id`) —
  // that is the ID used with fetchBuilds for that specific version snapshot.
  const buildPairs = []
  for (const { art, versions } of versionData) {
    for (const v of versions) {
      if (v.artefact_id) buildPairs.push({ art, version: v })
    }
  }

  // Phase 3 — fetch builds for each in-range version, collect execution IDs
  done = 0
  const execQueue = []
  await Promise.all(buildPairs.map(async ({ art, version }) => {
    try {
      const builds = await fetchBuilds(version.artefact_id)
      const date = versionToDate(version.version)
      for (const build of builds) {
        for (const exec of (build.test_executions ?? [])) {
          if (exec.test_plan !== 'Image build') {
            execQueue.push({
              art, version, date,
              arch: build.architecture || '',
              execId: exec.id,
              execStatus: exec.status,
              testPlan: exec.test_plan,
            })
          }
        }
      }
    } catch { /* skip */ }
    onProgress?.({ label: 'Fetching builds…', pct: 25 + Math.round((++done / (buildPairs.length || 1)) * 25) })
  }))

  // Phase 4 — fetch individual test results for each execution
  done = 0
  const entries = []
  await Promise.all(execQueue.map(async ({ art, version, date, arch, execId, execStatus, testPlan }) => {
    try {
      const results = await fetchTestResults(execId)
      const manual = testPlan === 'Manual Testing'
      for (const r of results) {
        entries.push({
          date,
          artefactId:  version.artefact_id,
          artefactName: art.name,
          displayName:  art.os || artifactTypeLabel(art.name, art.release),
          release:      art.release,
          os:           art.os || '',
          version:      version.version,
          arch,
          type:         artifactTypeLabel(art.name, art.release),
          execId,
          execStatus,
          testPlan,
          manual,
          resultId:  r.id,
          status:    r.status,   // PASSED | FAILED | SKIPPED
          tester:    parseTester(r.name),
          testCase:  parseTestCase(r.name),
          comment:   r.comment ?? '',
          bugs:      extractBugs(r),
        })
      }
    } catch { /* skip */ }
    onProgress?.({ label: 'Loading test results…', pct: 50 + Math.round((++done / (execQueue.length || 1)) * 48) })
  }))

  return entries
}

/** Top-level KPIs derived from a (possibly filtered) entries array. */
export function computeTestingKpis(entries) {
  const passed  = entries.filter(e => e.status === 'PASSED').length
  const failed  = entries.filter(e => e.status === 'FAILED').length
  const total   = passed + failed
  const passRate = total > 0 ? Math.round((passed / total) * 100) : null
  const bugs     = new Set(entries.flatMap(e => e.bugs)).size
  const testers  = new Set(entries.map(e => e.tester).filter(Boolean)).size
  const executions = new Set(entries.map(e => e.execId)).size
  const artifacts  = new Set(entries.map(e => e.artefactId)).size
  return { total, passed, failed, passRate, bugs, testers, executions, artifacts }
}

function dayISO(d) {
  return (
    String(d.getFullYear()) + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/** Daily pass/fail counts across the full date range (zero-filled). */
export function groupByDate(entries, dateFrom, dateTo) {
  const map = new Map()
  let d = new Date(dateFrom + 'T00:00:00')
  const end = new Date(dateTo + 'T00:00:00')
  while (d <= end) {
    const ds = dayISO(d)
    map.set(ds, { date: ds, passed: 0, failed: 0, total: 0 })
    d = new Date(d.getTime() + 86_400_000)
  }
  for (const e of entries) {
    if (!e.date || !map.has(e.date)) continue
    const day = map.get(e.date)
    if (e.status === 'PASSED') { day.passed++; day.total++ }
    else if (e.status === 'FAILED') { day.failed++; day.total++ }
  }
  return [...map.values()]
}

/** Per-artifact aggregation, sorted by failure count descending. */
export function groupByArtifact(entries) {
  const map = new Map()
  for (const e of entries) {
    const key = `${e.displayName}|${e.arch}|${e.release}`
    if (!map.has(key)) {
      map.set(key, {
        displayName: e.displayName, arch: e.arch, type: e.type,
        release: e.release, passed: 0, failed: 0, total: 0, bugs: new Set(),
      })
    }
    const row = map.get(key)
    if (e.status === 'PASSED') row.passed++
    else if (e.status === 'FAILED') row.failed++
    row.total++
    e.bugs.forEach(b => row.bugs.add(b))
  }
  return [...map.values()]
    .map(r => ({
      ...r,
      bugs: r.bugs.size,
      passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : null,
    }))
    .sort((a, b) => {
      // Nulls (no results) go to the bottom
      if (a.passRate === null && b.passRate === null) return 0
      if (a.passRate === null) return 1
      if (b.passRate === null) return -1
      return a.passRate - b.passRate
    })
}

/**
 * Per-tester aggregation, sorted by total tests descending.
 * mode: 'all' | 'manual' | 'automated'
 */
export function groupByTester(entries, mode = 'all') {
  const filtered = mode === 'manual'
    ? entries.filter(e => e.manual)
    : mode === 'automated'
      ? entries.filter(e => !e.manual)
      : entries

  const map = new Map()
  for (const e of filtered) {
    const tester = e.tester || '(unknown)'
    if (!map.has(tester)) {
      map.set(tester, {
        tester,
        passed: 0, failed: 0, total: 0,
        manualTotal: 0, automatedTotal: 0,
        bugs: new Set(),
      })
    }
    const row = map.get(tester)
    if (e.status === 'PASSED') row.passed++
    else if (e.status === 'FAILED') row.failed++
    row.total++
    if (e.manual) row.manualTotal++
    else row.automatedTotal++
    e.bugs.forEach(b => row.bugs.add(b))
  }
  return [...map.values()]
    .map(r => ({
      ...r,
      bugs:     r.bugs.size,
      passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total)
}

export function getUniqueOS(entries) {
  return [...new Set(entries.map(e => e.os).filter(Boolean))].sort()
}

export function getUniqueTesters(entries) {
  return [...new Set(entries.map(e => e.tester).filter(Boolean))].sort()
}

/** Compute the ISO date string for N days ago from today. */
export function dateNDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n + 1)
  return fmtDate(d)
}
