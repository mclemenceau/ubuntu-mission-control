const API_BASE = import.meta.env.PROD ? 'https://tests-api.ubuntu.com' : ''
const FETCH_TIMEOUT_MS = 30_000
const TTL_5MIN = 5 * 60 * 1000

// In-memory cache keyed by URL path.
// expiresAt === Infinity means session-permanent (immutable data).
const _cache = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt !== Infinity && Date.now() > entry.expiresAt) {
    _cache.delete(key)
    return undefined
  }
  return entry.data
}

function cacheSet(key, data, ttlMs) {
  _cache.set(key, {
    data,
    expiresAt: ttlMs === Infinity ? Infinity : Date.now() + ttlMs,
  })
}

export function clearCache() {
  _cache.clear()
}

async function apiFetch(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'X-CSRF-Token': '1' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`)
    return res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Timeout — ${path}`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function cachedFetch(path, ttlMs) {
  const hit = cacheGet(path)
  if (hit !== undefined) return hit
  const data = await apiFetch(path)
  cacheSet(path, data, ttlMs)
  return data
}

export const fetchArtefacts = (family = 'image') =>
  cachedFetch(`/v1/artefacts?family=${family}`, TTL_5MIN)

export const fetchArtefactVersions = artefactId =>
  cachedFetch(`/v1/artefacts/${artefactId}/versions`, TTL_5MIN)

export const fetchArtefact = artefactId =>
  cachedFetch(`/v1/artefacts/${artefactId}`, TTL_5MIN)

export const fetchBuilds = artefactId =>
  cachedFetch(`/v1/artefacts/${artefactId}/builds`, TTL_5MIN)

// Test results for a completed execution are immutable once recorded -
// cache for the full session so the snapshot panel costs nothing extra.
export const fetchTestResults = execId =>
  cachedFetch(`/v1/test-executions/${execId}/test-results`, Infinity)
