/** Returns today as YYYYMMDD — matches the artifact version date format. */
export function todayStr() {
  const d = new Date()
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  )
}

/**
 * Returns the number of days between the artifact version date and today.
 * Version format is YYYYMMDD or YYYYMMDD.N — anything else returns null.
 */
export function versionAgeDays(version) {
  const base = (version ?? '').slice(0, 8)
  if (!/^\d{8}$/.test(base)) return null
  const built = new Date(+base.slice(0, 4), +base.slice(4, 6) - 1, +base.slice(6, 8))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - built) / 86400000))
}

/** Formats a Date as HH:MM:SS */
export function fmtTime(d) {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Formats a Date as YYYY-MM-DD */
export function fmtDate(d) {
  return (
    String(d.getFullYear()) +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/**
 * Extracts the CPU architecture from an artifact filename.
 * e.g. "resolute-live-server-amd64.iso" → "amd64"
 */
export function extractArch(name) {
  const m = (name || '').match(/[-_](amd64|arm64(?:\+[\w]+)?|armhf|ppc64el|riscv64|s390x)(?:[-+.]|$)/)
  return m ? m[1] : ''
}

/**
 * Derives a human-readable type label from an artifact filename.
 * e.g. "resolute-live-server-amd64.iso" → "live-server"
 */
export function artifactTypeLabel(name, release) {
  let n = name || ''
  if (release && n.startsWith(release + '-')) n = n.slice(release.length + 1)
  // Strip trailing arch + extension(s)
  n = n.replace(
    /[-_]?(amd64|arm64(\+[\w]+)?|armhf|ppc64el|riscv64|s390x)([-+].+)?(\.\w+)+$/,
    '',
  )
  return n || name
}

/**
 * Returns a color class name ('green' | 'amber' | 'red' | 'neutral')
 * based on a 0-100 percentage value.
 */
export function pctColor(pct) {
  if (pct === null || pct === undefined) return 'neutral'
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
}

/** Formats seconds as M:SS */
export function fmtCountdown(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
