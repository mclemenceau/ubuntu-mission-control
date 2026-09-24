import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client.js', () => ({
  TO_FRONTEND_BASE: 'https://tests.ubuntu.com',
  fetchImageRerunQueue: vi.fn(),
}))

import { fetchImageRerunQueue } from '../api/client.js'
import {
  respinPageUrl,
  queuedArtefactIds,
  loadRespinQueue,
  applyRespinQueue,
} from './respin.js'

const rerun = (id, release, family = 'image') => ({
  test_execution_id: id * 10,
  artefact: { id, release, family },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('respin', () => {
  it('links to the Test Observer respin page for the release', () => {
    expect(respinPageUrl('stonking')).toBe('https://tests.ubuntu.com/#/respin?release=stonking')
    expect(respinPageUrl('a b&c', 'http://localhost:30001'))
      .toBe('http://localhost:30001/#/respin?release=a%20b%26c')
  })

  it('collects queued image artefacts of the release only', () => {
    const queue = [rerun(1, 'stonking'), rerun(2, 'resolute'), rerun(3, 'stonking', 'snap'), rerun(4, 'stonking')]
    expect(queuedArtefactIds(queue, 'stonking')).toEqual(new Set([1, 4]))
  })

  it('loads the queue for the release', async () => {
    fetchImageRerunQueue.mockResolvedValue([rerun(1, 'stonking'), rerun(2, 'noble')])
    await expect(loadRespinQueue('stonking')).resolves.toEqual(new Set([1]))
  })

  it('returns null rather than an empty queue when it cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchImageRerunQueue.mockRejectedValue(new Error('HTTP 403 — /v1/test-executions/reruns'))
    await expect(loadRespinQueue('stonking')).resolves.toBeNull()
  })

  it('flags queued products and keeps the identity of unchanged ones', () => {
    const unchanged = { id: 1, respinQueued: false }
    const newlyQueued = { id: 2, respinQueued: false }
    const pickedUp = { id: 3, respinQueued: true }

    const result = applyRespinQueue([unchanged, newlyQueued, pickedUp], new Set([2]))

    expect(result[0]).toBe(unchanged)
    expect(result[1]).toEqual({ id: 2, respinQueued: true })
    expect(result[2]).toEqual({ id: 3, respinQueued: false })
  })

  it('shows nothing as queued when the queue is unknown', () => {
    const result = applyRespinQueue([{ id: 1, respinQueued: true }], null)
    expect(result[0].respinQueued).toBe(false)
  })
})
