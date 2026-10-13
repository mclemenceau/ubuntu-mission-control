import { describe, expect, it } from 'vitest'
import {
  countEffective,
  extractBugs,
  latestExecutions,
  parseTestCase,
  parseTester,
  recentRuns,
  resolveResults,
} from './testResults.js'

const JENKINS = { id: 7740, name: 'platform-qa-jenkins.ps5.ubuntu.com' }
const MANUAL  = { id: 1729, name: 'user manual tests' }

function exec(id, plan, createdAt, extra = {}) {
  return {
    id, test_plan: plan, created_at: createdAt, environment: JENKINS,
    status: 'PASSED', ...extra,
  }
}

function result(id, name, status, createdAt, extra = {}) {
  return { id, name, status, created_at: createdAt, ...extra }
}

// Shape of artifact 34761 (stonking-live-server-ppc64el 20261012): three
// automated jobs each run twice, the first snap run failing, plus one
// manual execution with three results.
function artifact34761() {
  const e = {
    static1:  exec(62221, 'ISO Static Validation', '2026-10-12T09:47'),
    static2:  exec(62318, 'ISO Static Validation', '2026-10-12T19:33'),
    default1: exec(62231, 'ISO Smoke default', '2026-10-12T10:04'),
    default2: exec(62319, 'ISO Smoke default', '2026-10-12T19:34'),
    snap1:    exec(62236, 'ISO Smoke snap', '2026-10-12T10:15', { status: 'FAILED' }),
    snap2:    exec(62320, 'ISO Smoke snap', '2026-10-12T19:42'),
    manual:   exec(62202, 'Manual Testing', '2026-10-12T08:53', {
      environment: MANUAL, status: 'IN_PROGRESS',
    }),
  }
  return [
    { exec: e.static1, buildId: 33585,
      results: [result(36727, 'UTAH Static', 'PASSED', '2026-10-12T09:50')] },
    { exec: e.static2, buildId: 33585,
      results: [result(36828, 'UTAH Static', 'PASSED', '2026-10-12T19:40')] },
    { exec: e.default1, buildId: 33585,
      results: [result(36736, 'default', 'PASSED', '2026-10-12T10:10')] },
    { exec: e.default2, buildId: 33585,
      results: [result(36830, 'default', 'PASSED', '2026-10-12T19:45')] },
    { exec: e.snap1, buildId: 33585,
      results: [result(36742, 'snap', 'FAILED', '2026-10-12T10:20', {
        comment: 'LP: #2100001',
      })] },
    { exec: e.snap2, buildId: 33585,
      results: [result(36832, 'snap', 'PASSED', '2026-10-12T19:50')] },
    { exec: e.manual, buildId: 33585, results: [
      result(36793, 'patriciasd - PowerVM - POWER10 Virtual Media', 'PASSED', '2026-10-12T12:00'),
      result(36815, 'patriciasd - POWER9 netboot', 'PASSED', '2026-10-12T13:00'),
      result(36817, 'patriciasd - POWER9 KVM guest', 'PASSED', '2026-10-12T14:00'),
    ] },
  ]
}

describe('resolveResults', () => {
  it('keeps only the latest attempt of each re-run test', () => {
    const { effective, superseded } = resolveResults(artifact34761())

    expect(effective).toHaveLength(6)
    expect(superseded.map(s => s.result.id).sort()).toEqual([36727, 36736, 36742])
    expect(countEffective(effective)).toEqual({ passed: 6, failed: 0, recovered: 1 })

    const snap = effective.find(e => e.result.name === 'snap')
    expect(snap).toMatchObject({
      attempts: 2, history: ['FAILED'], recovered: true,
    })
    expect(snap.result.id).toBe(36832)
  })

  it('keeps results a partial rerun did not repeat', () => {
    const first  = exec(1, 'Smoke', '2026-10-12T10:00')
    const rerun  = exec(2, 'Smoke', '2026-10-12T12:00')
    const { effective } = resolveResults([
      { exec: first, buildId: 1, results: [
        result(10, 'a', 'PASSED', '2026-10-12T10:01'),
        result(11, 'b', 'FAILED', '2026-10-12T10:02'),
      ] },
      { exec: rerun, buildId: 1, results: [
        result(20, 'b', 'FAILED', '2026-10-12T12:01'),
      ] },
    ])

    expect(effective.map(e => e.result.id).sort()).toEqual([10, 20])
    expect(countEffective(effective)).toEqual({ passed: 1, failed: 1, recovered: 0 })
  })

  it('keeps the last known result while a rerun has no results yet', () => {
    const { effective } = resolveResults([
      { exec: exec(1, 'Smoke', '2026-10-12T10:00'), buildId: 1,
        results: [result(10, 'a', 'FAILED', '2026-10-12T10:01')] },
      { exec: exec(2, 'Smoke', '2026-10-12T12:00', { status: 'IN_PROGRESS' }),
        buildId: 1, results: [] },
    ])

    expect(effective).toHaveLength(1)
    expect(effective[0].result.id).toBe(10)
  })

  it('breaks created_at ties by id', () => {
    const at = '2026-10-12T10:00'
    const { effective } = resolveResults([
      { exec: exec(1, 'Smoke', at), buildId: 1,
        results: [result(11, 'a', 'PASSED', at)] },
      { exec: exec(2, 'Smoke', at), buildId: 1,
        results: [result(10, 'a', 'FAILED', at)] },
    ])

    expect(effective[0].result.id).toBe(11)
  })

  it('does not merge the same test across builds or environments', () => {
    const at = '2026-10-12T10:00'
    const { effective, superseded } = resolveResults([
      { exec: exec(1, 'Smoke', at), buildId: 1,
        results: [result(10, 'a', 'PASSED', at)] },
      { exec: exec(2, 'Smoke', at), buildId: 2,
        results: [result(20, 'a', 'FAILED', at)] },
      { exec: exec(3, 'Smoke', at, { environment: MANUAL }), buildId: 1,
        results: [result(30, 'a', 'PASSED', at)] },
    ])

    expect(effective).toHaveLength(3)
    expect(superseded).toHaveLength(0)
  })
})

describe('latestExecutions', () => {
  it('keeps the newest execution per build, environment and plan', () => {
    const execs = artifact34761().map(x => ({ ...x.exec, buildId: x.buildId }))
    expect(latestExecutions(execs).map(e => e.id).sort())
      .toEqual([62202, 62318, 62319, 62320])
  })
})

describe('recentRuns', () => {
  it('lists previous runs oldest first, ending with the current result', () => {
    const r = result(36832, 'snap', 'PASSED', '2026-10-12T19:50', {
      previous_results: [
        { status: 'FAILED', version: '20261012', artefact_id: 34761 },
        { status: 'PASSED', version: '20261007', artefact_id: 34246 },
        { status: 'PASSED', version: '20261005', artefact_id: 33989 },
        { status: 'PASSED', version: '20261005', artefact_id: 33989 },
        { status: 'PASSED', version: '20261004', artefact_id: 33826 },
      ],
    })

    expect(recentRuns(r, '20261012')).toEqual([
      { status: 'PASSED', version: '20261005' },
      { status: 'PASSED', version: '20261005' },
      { status: 'PASSED', version: '20261007' },
      { status: 'FAILED', version: '20261012' },
      { status: 'PASSED', version: '20261012' },
    ])
  })

  it('returns just the current run without history', () => {
    expect(recentRuns(result(1, 'a', 'FAILED', ''), 'v')).toEqual([
      { status: 'FAILED', version: 'v' },
    ])
  })
})

describe('result name and bug helpers', () => {
  it('splits manual result names and keeps automated names whole', () => {
    expect(parseTester('patriciasd - POWER9 netboot')).toBe('patriciasd')
    expect(parseTestCase('patriciasd - POWER9 netboot')).toBe('POWER9 netboot')
    expect(parseTestCase('snap')).toBe('snap')
  })

  it('extracts launchpad bugs from issues and comments', () => {
    expect(extractBugs({
      issues: [{ issue: { source: 'launchpad', key: '999999' } }],
      comment: 'LP: #123456, see bugs.launchpad.net/foo/+bug/234567',
    }).sort()).toEqual(['123456', '234567', '999999'])
  })
})
