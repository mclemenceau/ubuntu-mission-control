import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client.js', () => ({
  fetchBuilds: vi.fn(),
  fetchTestResults: vi.fn(),
}))

import { fetchBuilds, fetchTestResults } from '../api/client.js'
import {
  buildProductItems,
  enrichWithTestExecutions,
  enrichWithBugs,
  computeKpis,
  diffProducts,
} from './processor.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-12T09:00:00Z'))
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('processor', () => {
  it('builds product items for selected release with derived fields', () => {
    const artefacts = [
      { id: 1, name: 'resolute-live-server-amd64.iso', release: 'resolute', os: '', architecture: '', version: '20260412', status: 'APPROVED' },
      { id: 2, name: 'resolute-desktop-amd64.iso', release: 'other', os: '', architecture: '', version: '20260412', status: 'UNDECIDED' },
    ]

    const items = buildProductItems(artefacts, { release: 'resolute' })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 1,
      displayName: 'live-server',
      arch: 'amd64',
      type: 'live-server',
      builtToday: true,
      ageDays: 0,
    })
  })

  it('enriches items with execution status counts, excluding the Image build plan', async () => {
    const item = {
      id: 1,
      execIds: [],
      tests: { passed: 0, failed: 0, inProgress: 0, notStarted: 0 },
    }

    const env = id => ({ id, name: `env-${id}` })
    fetchBuilds.mockResolvedValue([
      {
        id: 100,
        test_executions: [
          { id: 11, test_plan: 'Manual Testing', environment: env(1), status: 'PASSED' },
          { id: 12, test_plan: 'Manual Testing', environment: env(2), status: 'FAILED' },
          { id: 13, test_plan: 'Manual Testing', environment: env(3), status: 'IN_PROGRESS' },
          { id: 14, test_plan: 'Manual Testing', environment: env(4), status: 'NOT_STARTED' },
          { id: 15, test_plan: 'Image build', environment: env(5), status: 'PASSED' },
          { id: 16, test_plan: 'Jenkins image validation', environment: env(5), status: 'PASSED' },
        ],
      },
    ])

    await enrichWithTestExecutions([item])

    expect(item.execIds).toEqual([11, 12, 13, 14, 16])
    expect(item.tests).toEqual({ passed: 2, failed: 1, inProgress: 1, notStarted: 1 })
  })

  it('counts only the latest execution of a re-run job', async () => {
    const item = { id: 1, execIds: [], tests: {} }
    const env = { id: 7740, name: 'jenkins' }
    fetchBuilds.mockResolvedValue([
      {
        id: 100,
        test_executions: [
          { id: 21, test_plan: 'ISO Smoke snap', environment: env,
            status: 'FAILED', created_at: '2026-04-12T10:00' },
          { id: 22, test_plan: 'ISO Smoke snap', environment: env,
            status: 'PASSED', created_at: '2026-04-12T19:00' },
        ],
      },
    ])

    await enrichWithTestExecutions([item])

    // Both attempts are kept for bug extraction, only the latest counts.
    expect(item.execIds).toEqual([21, 22])
    expect(item.tests).toEqual({ passed: 1, failed: 0, inProgress: 0, notStarted: 0 })
  })

  it('enriches items with bug extraction and result-based test counts', async () => {
    const env = { id: 1, name: 'jenkins' }
    const item = {
      id: 1,
      execIds: [16, 21],
      execs: new Map([
        [16, { id: 16, buildId: 100, test_plan: 'Smoke', environment: env }],
        [21, { id: 21, buildId: 100, test_plan: 'Manual Testing', environment: env }],
      ]),
      tests: { passed: 1, failed: 0, inProgress: 1, notStarted: 0 },
      bugs: [],
    }

    fetchTestResults.mockImplementation(execId =>
      Promise.resolve(
        execId === 16
          ? [{ name: 'default', status: 'PASSED', comment: '', issues: [] }]
          : [
              {
                name: 'alice - install',
                status: 'PASSED',
                comment: 'Investigated LP: #123456',
                issues: [{ issue: { source: 'launchpad', key: '999999' } }],
              },
              {
                name: 'alice - upgrade',
                status: 'FAILED',
                comment: 'See bugs.launchpad.net/foo/+bug/234567',
                issues: [],
              },
            ],
      ),
    )

    const bugCount = await enrichWithBugs([item])

    expect(bugCount).toBe(3)
    expect(item.tests).toEqual({
      passed: 2, failed: 1, inProgress: 0, notStarted: 0, recovered: 0,
    })
    expect(item.bugs.sort()).toEqual(['123456', '234567', '999999'])
  })

  it('counts the latest attempt of re-run results but keeps their bugs', async () => {
    const env = { id: 1, name: 'jenkins' }
    const item = {
      id: 1,
      execIds: [31, 32],
      execs: new Map([
        [31, { id: 31, buildId: 100, test_plan: 'Smoke', environment: env }],
        [32, { id: 32, buildId: 100, test_plan: 'Smoke', environment: env }],
      ]),
      tests: { passed: 0, failed: 0, inProgress: 0, notStarted: 0 },
      bugs: [],
    }

    fetchTestResults.mockImplementation(execId =>
      Promise.resolve(
        execId === 31
          ? [{ id: 1, name: 'snap', status: 'FAILED', created_at: '2026-04-12T10:00',
               comment: 'LP: #2100001', issues: [] }]
          : [{ id: 2, name: 'snap', status: 'PASSED', created_at: '2026-04-12T19:00',
               comment: '', issues: [] }],
      ),
    )

    const bugCount = await enrichWithBugs([item])

    expect(bugCount).toBe(1)
    expect(item.bugs).toEqual(['2100001'])
    expect(item.tests).toEqual({
      passed: 1, failed: 0, inProgress: 0, notStarted: 0, recovered: 1,
    })
  })

  it('computes KPIs from current product state', () => {
    const kpis = computeKpis([
      {
        builtToday: true,
        status: 'APPROVED',
        tests: { passed: 3, failed: 1, inProgress: 0, notStarted: 0 },
        bugs: ['123456'],
      },
      {
        builtToday: false,
        status: 'UNDECIDED',
        tests: { passed: 0, failed: 0, inProgress: 2, notStarted: 1 },
        bugs: ['123456', '999999'],
      },
    ])

    expect(kpis).toMatchObject({
      buildsToday: 1,
      approved: { count: 1, total: 2, pct: 50 },
      tests: { total: 7, passed: 3, failed: 1, inProgress: 2 },
      passRate: { pct: 75, passed: 3, outOf: 4 },
      bugs: 2,
    })
  })

  it('diffs products preserving identity for unchanged items', () => {
    const unchanged = {
      id: 1,
      status: 'APPROVED',
      tests: { passed: 1, failed: 0, inProgress: 0, notStarted: 0 },
      bugs: ['111111'],
    }
    const current = [unchanged]
    const next = [
      {
        id: 1,
        status: 'APPROVED',
        tests: { passed: 1, failed: 0, inProgress: 0, notStarted: 0 },
        bugs: ['111111'],
      },
      {
        id: 2,
        status: 'MARKED_AS_FAILED',
        tests: { passed: 0, failed: 1, inProgress: 0, notStarted: 0 },
        bugs: [],
      },
    ]

    const { products, changed } = diffProducts(current, next)

    expect(changed).toBe(true)
    expect(products[0]).toBe(unchanged)
    expect(products[1]).toMatchObject({ id: 2, _changeKind: 'new' })
    expect(typeof products[1]._changedAt).toBe('number')
  })
})
