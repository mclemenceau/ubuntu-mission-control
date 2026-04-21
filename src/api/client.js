const API_BASE = import.meta.env.PROD ? 'https://tests-api.ubuntu.com' : ''
const FETCH_TIMEOUT_MS = 30_000

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

export const fetchArtefacts = (family = 'image') =>
  apiFetch(`/v1/artefacts?family=${family}`)

export const fetchArtefactVersions = artefactId =>
  apiFetch(`/v1/artefacts/${artefactId}/versions`)

export const fetchArtefact = artefactId =>
  apiFetch(`/v1/artefacts/${artefactId}`)

export const fetchBuilds = artefactId =>
  apiFetch(`/v1/artefacts/${artefactId}/builds`)

export const fetchTestResults = execId =>
  apiFetch(`/v1/test-executions/${execId}/test-results`)
