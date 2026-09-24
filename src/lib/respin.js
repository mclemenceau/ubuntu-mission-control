import { TO_FRONTEND_BASE, fetchImageRerunQueue } from '../api/client.js'

/**
 * Test Observer page where a signed-in user reviews and confirms a respin of
 * every image of the release. Mission Control only links there: sign-in,
 * permissions and the request itself all stay in Test Observer.
 */
export function respinPageUrl(release, base = TO_FRONTEND_BASE) {
  return `${base}/#/respin?release=${encodeURIComponent(release)}`
}

/** IDs of the release's image artefacts with a respin waiting in the queue. */
export function queuedArtefactIds(pendingReruns, release) {
  return new Set(
    pendingReruns
      .filter(r => r.artefact?.family === 'image' && r.artefact?.release === release)
      .map(r => r.artefact.id),
  )
}

/**
 * Returns a Set of queued artefact IDs, or null when the queue can't be read.
 * Callers must treat null as "unknown" and hide queue state rather than show
 * nothing as queued.
 */
export async function loadRespinQueue(release) {
  try {
    return queuedArtefactIds(await fetchImageRerunQueue(), release)
  } catch (err) {
    console.warn('Respin queue unavailable:', err.message)
    return null
  }
}

/**
 * Sets respinQueued on each product from the queue (null = unknown, shown as
 * not queued). Unchanged products keep their identity so Svelte skips them.
 */
export function applyRespinQueue(products, queuedIds) {
  return products.map(p => {
    const respinQueued = queuedIds?.has(p.id) ?? false
    return p.respinQueued === respinQueued ? p : { ...p, respinQueued }
  })
}
