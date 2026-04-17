/**
 * Generates human-readable notification objects from a list of changed products.
 * Each changed product is expected to have _changeKind and optionally _prev
 * (populated by diffProducts) so per-field deltas can be computed.
 */
export function generateNotifications(changedProducts) {
  const notifications = []
  const now = Date.now()
  let seq = 0

  for (const p of changedProducts) {
    const name  = p.displayName || p.name
    const arch  = p.arch    ? ` (${p.arch})`    : ''
    const rel   = p.release ? ` · ${p.release}` : ''
    const label = `${name}${arch}${rel}`

    if (p._changeKind === 'new') {
      notifications.push({
        id:        `${now}-${p.id}-build-${seq++}`,
        timestamp: now,
        type:      'build',
        productId: p.id,
        title:     p.builtToday ? 'New build today' : 'New build detected',
        detail:    `${label} — version ${p.version ?? '?'}`,
      })
      continue
    }

    if (p._changeKind === 'approved') {
      notifications.push({
        id:        `${now}-${p.id}-approved-${seq++}`,
        timestamp: now,
        type:      'approved',
        productId: p.id,
        title:     'Build approved',
        detail:    label,
      })
      continue
    }

    if (p._changeKind === 'failed') {
      notifications.push({
        id:        `${now}-${p.id}-failed-${seq++}`,
        timestamp: now,
        type:      'failed',
        productId: p.id,
        title:     'Build marked as failed',
        detail:    label,
      })
      continue
    }

    if (p._changeKind === 'status') {
      notifications.push({
        id:        `${now}-${p.id}-status-${seq++}`,
        timestamp: now,
        type:      'status',
        productId: p.id,
        title:     'Status updated',
        detail:    `${label} → ${p.status ?? 'unknown'}`,
      })
      continue
    }

    if (p._changeKind === 'tests') {
      const prev      = p._prev ?? {}
      const prevTests = prev.tests ?? { passed: 0, failed: 0 }
      const newPassed = Math.max(0, p.tests.passed - prevTests.passed)
      const newFailed = Math.max(0, p.tests.failed - prevTests.failed)

      if (newPassed > 0) {
        notifications.push({
          id:        `${now}-${p.id}-pass-${seq++}`,
          timestamp: now,
          type:      'test-pass',
          productId: p.id,
          title:     `${newPassed} test${newPassed > 1 ? 's' : ''} passed`,
          detail:    `On ${label}`,
        })
      }
      if (newFailed > 0) {
        notifications.push({
          id:        `${now}-${p.id}-fail-${seq++}`,
          timestamp: now,
          type:      'test-fail',
          productId: p.id,
          title:     `${newFailed} test${newFailed > 1 ? 's' : ''} failed`,
          detail:    `On ${label}`,
        })
      }

      // Detect newly filed bugs vs the previous snapshot
      const prevBugSet = new Set(prev.bugs ?? [])
      const newBugs    = (p.bugs ?? []).filter(b => !prevBugSet.has(b))
      for (const bug of newBugs) {
        notifications.push({
          id:        `${now}-${p.id}-bug-${bug}-${seq++}`,
          timestamp: now,
          type:      'bug',
          productId: p.id,
          title:     'New bug reported',
          detail:    `LP #${bug} on ${label}`,
        })
      }
    }
  }

  return notifications
}

/** Formats a notification timestamp into a human-readable age string. */
export function fmtNotifAge(timestamp) {
  const diff = Date.now() - timestamp
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}
