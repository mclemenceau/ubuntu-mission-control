// Helpers for interpreting Test Observer test executions and results.
//
// Test Observer keeps every attempt when an execution is re-run: a rerun
// creates a new execution on the same build, environment and test plan,
// and its results sit next to the earlier ones. Only the latest attempt of
// each test reflects the current state of an artifact, so counting must go
// through resolveResults() rather than summing raw results.

const BUG_PATTERNS = [
  /bugs\.launchpad\.net\/[^\s)]+\/\+bug\/(\d+)/gi,
  /\bbug\s*#?(\d{5,7})\b/gi,
  /\bLP[:\s]+#?(\d{5,7})\b/gi,
]

/** Launchpad bug ids from a result's structured issues and comment. */
export function extractBugs(result) {
  const bugs = new Set()
  for (const { issue } of result.issues ?? []) {
    if (issue?.source === 'launchpad' && issue?.key) bugs.add(issue.key)
  }
  const comment = result.comment ?? ''
  for (const pat of BUG_PATTERNS) {
    for (const m of comment.matchAll(pat)) bugs.add(m[1])
  }
  return [...bugs]
}

/** Manual results are named "tester - test case"; automated ones are not. */
export function parseTester(name) {
  const idx = (name || '').indexOf(' - ')
  return idx > 0 ? name.slice(0, idx).trim() : (name || '').trim()
}

export function parseTestCase(name) {
  const idx = (name || '').indexOf(' - ')
  return idx > 0 ? name.slice(idx + 3).trim() : (name || '').trim()
}

function envKey(exec) {
  return exec.environment?.id ?? exec.environment?.name ?? ''
}

/** Attempts at the same job share build, environment and test plan. */
export function execSlot(exec, buildId) {
  return `${buildId}|${envKey(exec)}|${exec.test_plan ?? ''}`
}

/** Orders by created_at, then id, so the last element is the newest. */
function byAge(a, b) {
  const ta = a.created_at ?? ''
  const tb = b.created_at ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return (a.id ?? 0) - (b.id ?? 0)
}

/**
 * Keep only the newest execution per (build, environment, test plan).
 * Each execution must carry a `buildId` property.
 */
export function latestExecutions(executions) {
  const latest = new Map()
  for (const exec of executions) {
    const key = execSlot(exec, exec.buildId)
    const prev = latest.get(key)
    if (!prev || byAge(prev, exec) < 0) latest.set(key, exec)
  }
  return [...latest.values()]
}

/**
 * Collapse re-run attempts into one effective result per test.
 *
 * A test slot is (build, environment, test plan, result name). Results are
 * resolved individually rather than per execution so that a partial rerun
 * keeps the results it did not repeat, and a queued rerun with no results
 * yet does not hide the last known result.
 *
 * execResults: [{ exec, buildId, results }]
 * Returns {
 *   effective:  [{ exec, buildId, result, attempts, history, recovered }],
 *   superseded: [{ exec, buildId, result }],
 * }
 * history lists the statuses of earlier attempts, oldest first.
 */
export function resolveResults(execResults) {
  const slots = new Map()
  for (const { exec, buildId, results } of execResults) {
    for (const result of results ?? []) {
      const key = `${execSlot(exec, buildId)}|${result.name ?? ''}`
      if (!slots.has(key)) slots.set(key, [])
      slots.get(key).push({ exec, buildId, result })
    }
  }

  const effective = []
  const superseded = []
  for (const attempts of slots.values()) {
    attempts.sort((a, b) => byAge(a.result, b.result))
    const latest = attempts.at(-1)
    const earlier = attempts.slice(0, -1)
    const history = earlier.map(a => a.result.status)
    effective.push({
      ...latest,
      attempts: attempts.length,
      history,
      recovered: latest.result.status === 'PASSED'
        && history.includes('FAILED'),
    })
    superseded.push(...earlier)
  }
  return { effective, superseded }
}

/** Pass/fail/recovered tallies over resolved effective results. */
export function countEffective(effective) {
  let passed = 0, failed = 0, recovered = 0
  for (const e of effective) {
    if (e.result.status === 'PASSED') passed++
    else if (e.result.status === 'FAILED') failed++
    if (e.recovered) recovered++
  }
  return { passed, failed, recovered }
}

/**
 * Recent runs of a test, oldest first, ending with the given result.
 * Uses Test Observer's previous_results (newest first), which covers both
 * reruns on this artifact and earlier versions.
 * Each run: { status, version }
 */
export function recentRuns(result, version, limit = 5) {
  const previous = (result.previous_results ?? [])
    .slice(0, limit - 1)
    .reverse()
    .map(p => ({ status: p.status, version: p.version }))
  return [...previous, { status: result.status, version }]
}
