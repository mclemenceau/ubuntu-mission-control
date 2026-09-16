import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  todayStr,
  versionAgeDays,
  extractArch,
  artifactTypeLabel,
  pctColor,
  fmtCountdown,
} from './utils.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('utils', () => {
  it('formats today as YYYYMMDD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T08:00:00Z'))
    expect(todayStr()).toBe('20260412')
  })

  it('computes version age in days and handles invalid input', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'))

    expect(versionAgeDays('20260410')).toBe(2)
    expect(versionAgeDays('20260412.1')).toBe(0)
    expect(versionAgeDays('invalid')).toBeNull()
  })

  it('extracts architecture from artifact names', () => {
    expect(extractArch('resolute-live-server-amd64.iso')).toBe('amd64')
    expect(extractArch('ubuntu-foo-arm64+raspi.img')).toBe('arm64+raspi')
    expect(extractArch('ubuntu-unknown.img')).toBe('')
    expect(extractArch('stonking-desktop-amd64v3.iso')).toBe('amd64v3')
  })

  it('derives artifact type labels', () => {
    expect(artifactTypeLabel('resolute-live-server-amd64.iso', 'resolute')).toBe('live-server')
    expect(artifactTypeLabel('foo-custom-arm64+raspi.img.xz', 'foo')).toBe('custom')
    expect(artifactTypeLabel('stonking-desktop-amd64v3.iso', 'stonking')).toBe('desktop')
  })

  it('returns color classes from percentages', () => {
    expect(pctColor(null)).toBe('neutral')
    expect(pctColor(90)).toBe('green')
    expect(pctColor(60)).toBe('amber')
    expect(pctColor(20)).toBe('red')
  })

  it('formats countdown values', () => {
    expect(fmtCountdown(0)).toBe('0:00')
    expect(fmtCountdown(61)).toBe('1:01')
  })
})
