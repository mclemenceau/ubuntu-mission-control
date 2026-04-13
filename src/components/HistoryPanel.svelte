<script>
  import { onMount } from 'svelte'
  import { fetchArtefact, fetchArtefactVersions, fetchBuilds, fetchTestResults } from '../api/client.js'

  /** @type {{ product: import('../lib/processor.js').Product, showCalendar?: boolean, onArtefactChange?: (a: any) => void }} */
  let { product, showCalendar = true, onArtefactChange = null } = $props()

  let loading        = $state(true)   // fast initial load (current build only)
  let error          = $state(null)
  let days           = $state([])     // 30 entries, index 0 = oldest
  let rate           = $state(null)   // { built, approved, total } — set after full history load
  let selectedDay    = $state(null)   // index into days[]
  let productSlot    = $state(-1)     // days[] index of the current artifact
  let historyLoading = $state(false)  // full 30-day load in progress
  let historyLoaded  = $state(false)  // full 30-day load complete
  let historyError   = $state(null)

  const STATUS_LABELS = {
    APPROVED:         '✓ Approved',
    MARKED_AS_FAILED: '✗ Failed',
    UNDECIDED:        '? Undecided',
  }

  // ── Helpers shared by both load paths ─────────────────────────────────
  async function loadDayTestData(day, rawBuilds) {
    const execs = rawBuilds
      .flatMap(b => b.test_executions ?? [])
      .filter(te => te.test_plan === 'Manual Testing')

    let passed     = execs.filter(e => e.status === 'PASSED').length
    let failed     = execs.filter(e => ['FAILED', 'ENDED_PREMATURELY'].includes(e.status)).length
    let inProgress = execs.filter(e => e.status === 'IN_PROGRESS').length
    let notStarted = execs.filter(e => ['NOT_STARTED', 'NOT_TESTED'].includes(e.status)).length

    const execResults = new Map()
    let resultPassed = 0, resultFailed = 0
    const execsWithResults = new Set()
    await Promise.all(
      execs.map(async exec => {
        const results = await fetchTestResults(exec.id).catch(() => [])
        execResults.set(exec.id, results)
        if (results.length > 0) {
          execsWithResults.add(exec.id)
          for (const r of results) {
            if (r.status === 'PASSED')      resultPassed++
            else if (r.status === 'FAILED') resultFailed++
          }
        }
      }),
    )
    if (resultPassed + resultFailed > 0) {
      passed     = resultPassed
      failed     = resultFailed
      inProgress = Math.max(0, inProgress - execsWithResults.size)
    }

    day.tests = { passed, failed, inProgress, notStarted }
    day.builds = rawBuilds
      .map(b => ({
        ...b,
        test_executions: (b.test_executions ?? [])
          .filter(te => te.test_plan === 'Manual Testing')
          .map(exec => ({ ...exec, results: execResults.get(exec.id) ?? [] })),
      }))
      .filter(b => b.test_executions.length > 0)
  }

  // ── Fast path: load only the current artifact on mount ────────────────
  onMount(async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Build 30-day scaffold (all empty)
      const dayData = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (29 - i))
        const key = d.toISOString().slice(0, 10)
        return { date: key, artefactId: null, artefact: null, tests: null, builds: [] }
      })

      // Place current product in its date slot (derived from version prefix)
      const productBase = (product.version ?? '').slice(0, 8)
      productSlot = dayData.length - 1  // default: last slot (today)
      if (/^\d{8}$/.test(productBase)) {
        const productKey = `${productBase.slice(0, 4)}-${productBase.slice(4, 6)}-${productBase.slice(6, 8)}`
        const idx = dayData.findIndex(d => d.date === productKey)
        if (idx !== -1) productSlot = idx  // now a $state, readable by effects
      }

      dayData[productSlot].artefactId = product.id
      // Construct minimal artefact from product props — no extra API call needed
      dayData[productSlot].artefact = { id: product.id, version: product.version, status: product.status }

      const rawBuilds = await fetchBuilds(product.id)
      await loadDayTestData(dayData[productSlot], rawBuilds)

      days = dayData
      selectedDay = productSlot
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  // ── Lazy path: load full 30-day history only when calendar is opened ───
  $effect(() => {
    if (showCalendar && !historyLoaded && !historyLoading) {
      loadFullHistory()
    }
  })

  // ── Reset to latest build when switching back from history ────────────
  $effect(() => {
    if (!showCalendar && productSlot !== -1) selectedDay = productSlot
  })

  async function loadFullHistory() {
    historyLoading = true
    historyError = null
    try {
      const rawVersions = await fetchArtefactVersions(product.id)

      // Build date → artefact_id map
      const byDate = new Map()
      for (const v of rawVersions) {
        const base = (v.version ?? '').slice(0, 8)
        if (!/^\d{8}$/.test(base)) continue
        const key = `${base.slice(0, 4)}-${base.slice(4, 6)}-${base.slice(6, 8)}`
        const prev = byDate.get(key)
        if (!prev || v.version > prev.version) byDate.set(key, v.artefact_id)
      }

      // Ensure current artifact is always included (API may omit latest)
      const productBase = (product.version ?? '').slice(0, 8)
      if (/^\d{8}$/.test(productBase)) {
        const productKey = `${productBase.slice(0, 4)}-${productBase.slice(4, 6)}-${productBase.slice(6, 8)}`
        if (!byDate.has(productKey)) byDate.set(productKey, product.id)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dayData = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (29 - i))
        const key = d.toISOString().slice(0, 10)
        return { date: key, artefactId: byDate.get(key) ?? null, artefact: null, tests: null, builds: [] }
      })

      await Promise.all(
        dayData.map(async day => {
          if (!day.artefactId) return
          const [artefact, rawBuilds] = await Promise.all([
            fetchArtefact(day.artefactId),
            fetchBuilds(day.artefactId).catch(() => []),
          ])
          day.artefact = artefact
          await loadDayTestData(day, rawBuilds)
        }),
      )

      days = dayData
      const built    = dayData.filter(d => d.artefact).length
      const approved = dayData.filter(d => d.artefact?.status === 'APPROVED').length
      rate = { built, approved, total: 30 }

      // Preserve current selection if still valid, otherwise pick last built day
      if (selectedDay === null || !dayData[selectedDay]?.artefact) {
        const lastBuiltIdx = dayData.reduceRight(
          (found, d, i) => (found !== -1 ? found : d.artefact ? i : -1), -1,
        )
        if (lastBuiltIdx !== -1) selectedDay = lastBuiltIdx
      }

      historyLoaded = true
    } catch (e) {
      historyError = e.message
    } finally {
      historyLoading = false
    }
  }

  function dayLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }

  function isToday(dateStr) {
    return dateStr === new Date().toISOString().slice(0, 10)
  }

  function statusClass(day) {
    return day.artefact ? 'built' : 'miss'
  }

  function approvalMark(day) {
    if (!day.artefact)                               return { mark: '', cls: '' }
    if (day.artefact.status === 'APPROVED')          return { mark: '✓', cls: 'mark-ok' }
    if (day.artefact.status === 'MARKED_AS_FAILED')  return { mark: '✗', cls: 'mark-fail' }
    return { mark: '', cls: '' }
  }

  function testLine(tests) {
    if (!tests) return null
    const parts = []
    if (tests.passed)     parts.push(`${tests.passed}✓`)
    if (tests.failed)     parts.push(`${tests.failed}✗`)
    if (tests.inProgress) parts.push(`${tests.inProgress}…`)
    return parts.length ? parts.join(' ') : null
  }

  let ratePct = $derived(rate ? Math.round((rate.built / rate.total) * 100) : 0)
  let rateColor = $derived(
    ratePct >= 70 ? '#4caf50' : ratePct >= 40 ? '#ff9800' : '#e53935',
  )

  // Currently selected day object
  let selDay = $derived(selectedDay !== null ? (days[selectedDay] ?? null) : null)

  // Notify parent whenever the viewed artefact changes (used to update details strip)
  $effect(() => { onArtefactChange?.(selDay?.artefact ?? null) })

  // ── Detail panel helpers ────────────────────────────────────────────
  function parseResultName(name) {
    if (!name) return { tester: null, testName: '—' }
    const idx = name.indexOf(' - ')
    if (idx === -1) return { tester: null, testName: name }
    return { tester: name.slice(0, idx), testName: name.slice(idx + 3) }
  }

  function execStatusClass(status) {
    if (status === 'PASSED')                                   return 'exec-passed'
    if (['FAILED', 'ENDED_PREMATURELY'].includes(status))     return 'exec-failed'
    if (status === 'IN_PROGRESS')                              return 'exec-progress'
    return 'exec-pending'
  }

  function resultStatusClass(status) {
    if (status === 'PASSED') return 'res-pass'
    if (status === 'FAILED') return 'res-fail'
    return 'res-other'
  }

  function statusBadgeClass(status) {
    if (status === 'APPROVED')          return 'badge-ok'
    if (status === 'MARKED_AS_FAILED')  return 'badge-fail'
    return 'badge-neutral'
  }
</script>

<div class="history-panel">
  {#if showCalendar}
    <!-- ── Summary header ────────────────────────────────────────── -->
    {#if !loading && !error && rate}
      <div class="summary">
        <div class="summary-left">
          <span class="summary-title">30-day build history</span>
          <span class="summary-sub">{rate.built} of {rate.total} days built · {rate.approved} approved</span>
        </div>
        <div class="rate-wrap">
          <span class="rate-label" style="color: {rateColor}">{ratePct}%</span>
          <div class="rate-track">
            <div class="rate-fill" style="width: {ratePct}%; background: {rateColor}"></div>
          </div>
          <span class="rate-desc">build rate</span>
        </div>
      </div>
    {/if}

    <!-- ── State messages ──────────────────────────────────────────── -->
    {#if historyError}
      <div class="hist-state err">Error: {historyError}</div>
    {:else if !historyLoaded}
      <div class="hist-state">Loading 30-day history…</div>
    {:else if days.every(d => !d.artefact)}
      <div class="hist-state">No historical data found for this product.</div>
    {:else}
      <!-- ── Day columns ────────────────────────────────────────────── -->
      <div class="day-grid">
        {#each days as day, i}
          {@const sc             = statusClass(day)}
          {@const { mark, cls } = approvalMark(day)}
          {@const tl             = testLine(day.tests)}
          {@const isSelected     = i === selectedDay}
          <div class="day-col" class:today={isToday(day.date)} class:selected={isSelected}>
            <!-- Test metrics -->
            <div class="test-line" class:has-data={!!tl}>
              {#if tl}
                {#each tl.split(' ') as chunk}
                  <span class="tl-chip"
                        class:tl-pass={chunk.endsWith('✓')}
                        class:tl-fail={chunk.endsWith('✗')}
                        class:tl-prog={chunk.endsWith('…')}
                  >{chunk}</span>
                {/each}
              {:else if day.artefact}
                <span class="tl-none">—</span>
              {/if}
            </div>

            <!-- Status block — clickable on built days -->
            {#if day.artefact}
              <button
                class="day-block {sc} clickable"
                title="{day.date} · {day.artefact.status ?? 'UNDECIDED'}"
                onclick={() => { selectedDay = i }}
              >
                <span class="day-mark {cls}">{mark}</span>
              </button>
            {:else}
              <div class="day-block {sc}" title="{day.date} · no build">
                <span class="day-mark {cls}">{mark}</span>
              </div>
            {/if}

            <!-- Date label -->
            <div class="day-label" class:today-label={isToday(day.date)}>
              {dayLabel(day.date)}
            </div>
          </div>
        {/each}
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="leg-item"><span class="leg-swatch built"></span>Built</span>
        <span class="leg-item"><span class="leg-swatch miss"></span>No build</span>
        <span class="leg-item"><span class="mark-ok leg-mark">✓</span>Approved</span>
        <span class="leg-item"><span class="mark-fail leg-mark">✗</span>Not approved</span>
        <span class="leg-item leg-hint">Click a day to see its test results</span>
      </div>
    {/if}

  {:else if loading}
    <div class="hist-state">Loading test data…</div>
  {:else if error}
    <div class="hist-state err">Error: {error}</div>
  {/if}

  <!-- ── Day detail panel — shown in both Latest Build and History modes ── -->
  {#if !loading && !error && selDay}
    <div class="detail-panel">
      <!-- Detail header -->
      <div class="detail-hdr">
        <div class="detail-hdr-left">
          <span class="detail-date">{dayLabel(selDay.date)}{isToday(selDay.date) ? ' (today)' : ''}</span>
          <span class="detail-version">{selDay.artefact?.version ?? '—'}</span>
          <span class="detail-status-badge {statusBadgeClass(selDay.artefact?.status)}">
            {STATUS_LABELS[selDay.artefact?.status] ?? '—'}
          </span>
        </div>
        {#if selDay.tests}
          <div class="detail-counts">
            {#if selDay.tests.passed}     <span class="chip chip-pass">✓ {selDay.tests.passed}</span>{/if}
            {#if selDay.tests.failed}     <span class="chip chip-fail">✗ {selDay.tests.failed}</span>{/if}
            {#if selDay.tests.inProgress} <span class="chip chip-prog">… {selDay.tests.inProgress}</span>{/if}
            {#if selDay.tests.notStarted} <span class="chip chip-skip">○ {selDay.tests.notStarted}</span>{/if}
            {#if selDay.tests.passed + selDay.tests.failed + selDay.tests.inProgress + selDay.tests.notStarted === 0}
              <span class="chip-none">no executions</span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Executions + results -->
      {#if !selDay.builds || selDay.builds.length === 0}
        <div class="detail-empty">No test executions for this build.</div>
      {:else}
        {#each selDay.builds as build}
          {#each build.test_executions as exec}
            <div class="det-exec">
              <div class="det-exec-hdr">
                <div class="det-exec-left">
                  <span class="det-plan">{exec.test_plan ?? 'Test execution'}</span>
                  {#if exec.environment?.name}
                    <span class="det-env">{exec.environment.name}</span>
                  {/if}
                </div>
                <span class="exec-badge {execStatusClass(exec.status)}">{exec.status ?? '—'}</span>
              </div>

              {#if exec.results.length === 0}
                <div class="det-no-results">No results submitted yet.</div>
              {:else}
                <table class="det-table">
                  <thead>
                    <tr>
                      <th>Tester</th>
                      <th>Test</th>
                      <th>Status</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each exec.results as r}
                      {@const { tester, testName } = parseResultName(r.name)}
                      <tr class={resultStatusClass(r.status)}>
                        <td class="det-tester">{tester ?? '—'}</td>
                        <td class="det-name">{testName}</td>
                        <td><span class="res-badge {resultStatusClass(r.status)}">{r.status ?? '—'}</span></td>
                        <td class="det-comment">{r.comment ?? ''}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              {/if}
            </div>
          {/each}
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .history-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.54rem 1.25rem;
  }

  /* ── Summary ──────────────────────────────────────────────────── */
  .summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .summary-left {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .summary-title {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .summary-sub {
    font-size: 1rem;
    color: var(--text-muted);
  }

  .rate-wrap {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .rate-label {
    font-size: 1.35rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 3.2rem;
    text-align: right;
  }

  .rate-track {
    width: 110px;
    height: 7px;
    background: var(--bg-raised);
    border-radius: 4px;
    overflow: hidden;
  }

  .rate-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  .rate-desc {
    font-size: 0.88rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* ── State message ────────────────────────────────────────────── */
  .hist-state {
    font-size: 1.06rem;
    color: var(--text-dim);
    padding: 1.25rem 0;
    text-align: center;
  }
  .hist-state.err { color: var(--red); }

  /* ── Day grid ─────────────────────────────────────────────────── */
  .day-grid {
    display: flex;
    gap: 3px;
  }

  .day-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    width: 32px;
  }

  /* Today: accent ring (blue) */
  .day-col.today .day-block {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* Selected: bright white ring, overrides today ring */
  .day-col.selected .day-block {
    outline: 2px solid #fff;
    outline-offset: 2px;
    filter: brightness(1.35);
  }

  /* Both today and selected */
  .day-col.today.selected .day-block {
    outline: 2px solid #fff;
    outline-offset: 2px;
    filter: brightness(1.35);
  }

  /* Test metrics line */
  .test-line {
    display: flex;
    gap: 1px;
    align-items: center;
    justify-content: center;
    height: 14px;
    font-size: 0.58rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .tl-chip {
    padding: 0 1px;
    border-radius: 2px;
    line-height: 1.3;
  }
  .tl-pass { color: #5ddb5d; }
  .tl-fail { color: var(--red); }
  .tl-prog { color: var(--blue); }
  .tl-none { color: var(--text-dim); font-size: 0.6rem; }

  /* Status block */
  .day-block {
    width: 32px;
    height: 38px;
    padding: 0;
    border: none;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    color: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    transition: transform 0.1s, filter 0.1s;
    cursor: default;
  }
  .day-block.clickable         { cursor: pointer; }
  .day-block.clickable:hover   { transform: scaleY(1.08); filter: brightness(1.2); }
  .day-block.clickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .day-block.built { background: #1a4d1a; }
  .day-block.miss  { background: #4d1a1a; }

  .day-mark { line-height: 1; font-size: 0.9rem; }
  .mark-ok   { color: #5ddb5d; }
  .mark-fail { color: var(--red); }

  /* Date label */
  .day-label {
    font-size: 0.55rem;
    color: var(--text-muted);
    text-align: center;
    white-space: nowrap;
    line-height: 1.2;
  }

  .today-label {
    color: var(--accent);
    font-weight: 700;
  }

  /* ── Legend ───────────────────────────────────────────────────── */
  .legend {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
    align-items: center;
    padding-top: 0.25rem;
  }

  .leg-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .leg-hint {
    margin-left: auto;
    font-style: italic;
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  .leg-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .leg-swatch.built { background: #1a4d1a; }
  .leg-swatch.miss  { background: #4d1a1a; }
  .leg-mark { font-size: 0.85rem; font-weight: 700; }

  /* ── Detail panel ─────────────────────────────────────────────── */
  .detail-panel {
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .detail-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 1.1rem;
    background: var(--surface-faint);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-wrap: wrap;
  }

  .detail-hdr-left {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .detail-date {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-bright);
  }

  .detail-version {
    font-size: 0.97rem;
    font-family: monospace;
    color: var(--text-dim);
  }

  .detail-status-badge {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.12em 0.5em;
    border-radius: 4px;
  }
  .badge-ok      { background: var(--green-border); color: #5ddb5d; }
  .badge-fail    { background: var(--red-border);   color: var(--red); }
  .badge-neutral { background: var(--bg-raised);    color: var(--text-muted); }

  .detail-counts {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .chip {
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-size: 0.97rem;
    font-weight: 700;
  }
  .chip-pass { background: #1a4d1a; color: #5ddb5d; }
  .chip-fail { background: #4d1a1a; color: var(--red); }
  .chip-prog { background: #1a2d4d; color: var(--blue); }
  .chip-skip { background: #2a2a2a; color: var(--text-muted); }
  .chip-none { font-size: 0.9rem; color: var(--text-dim); font-style: italic; }

  .detail-empty {
    font-size: 1rem;
    color: var(--text-dim);
    font-style: italic;
    padding: 1rem 1.1rem;
  }

  /* ── Execution blocks ─────────────────────────────────────────── */
  .det-exec {
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .det-exec:first-child { border-top: none; }

  .det-exec-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    padding: 0.55rem 1.1rem;
    background: var(--surface-shade);
  }

  .det-exec-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex: 1;
    min-width: 0;
  }

  .det-plan {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-soft);
  }

  .det-env {
    font-size: 0.9rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .det-no-results {
    font-size: 0.95rem;
    color: var(--text-dim);
    font-style: italic;
    padding: 0.55rem 1.1rem;
  }

  /* ── Results table ────────────────────────────────────────────── */
  .det-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 1rem;
  }

  .det-table thead tr { background: rgba(0,0,0,0.2); }
  .det-table th {
    text-align: left;
    padding: 0.35rem 1.1rem;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border-faint);
  }
  .det-table td {
    padding: 0.4rem 1.1rem;
    vertical-align: top;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-soft);
  }
  .det-table tr:last-child td { border-bottom: none; }

  .res-pass td { background: rgba(0,60,0,0.15); }
  .res-fail td { background: rgba(60,0,0,0.15); }

  .det-tester  { color: var(--text-muted); white-space: nowrap; font-size: 0.95rem; }
  .det-name    { color: var(--text-normal); }
  .det-comment { color: var(--text-muted); font-style: italic; font-size: 0.95rem; }

  /* ── Exec badge ───────────────────────────────────────────────── */
  .exec-badge {
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.1em 0.45em;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .exec-passed  { background: #1a4d1a; color: #5ddb5d; }
  .exec-failed  { background: #4d1a1a; color: var(--red); }
  .exec-progress{ background: #1a2d4d; color: var(--blue); }
  .exec-pending { background: var(--bg-raised); color: var(--text-muted); }

  /* ── Result badge ─────────────────────────────────────────────── */
  .res-badge {
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.1em 0.4em;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .res-badge.res-pass  { background: #1a4d1a; color: #5ddb5d; }
  .res-badge.res-fail  { background: #4d1a1a; color: var(--red); }
  .res-badge.res-other { background: var(--bg-raised); color: var(--text-muted); }
</style>
