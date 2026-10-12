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
    APPROVED:         'Approved',
    MARKED_AS_FAILED: 'Failed',
    UNDECIDED:        'Undecided',
  }

  // ── Helpers shared by both load paths ─────────────────────────────────
  async function loadDayTestData(day, rawBuilds) {
    const execs = rawBuilds
      .flatMap(b => b.test_executions ?? [])
      .filter(te => te.test_plan !== 'Image build')

    let passed     = execs.filter(e => e.status === 'PASSED').length
    let failed     = execs.filter(e => ['FAILED', 'ENDED_PREMATURELY'].includes(e.status)).length
    let inProgress = execs.filter(e => e.status === 'IN_PROGRESS').length
    let notStarted = execs.filter(e => ['NOT_STARTED', 'NOT_TESTED'].includes(e.status)).length

    const inProgressIds = new Set(execs.filter(e => e.status === 'IN_PROGRESS').map(e => e.id))
    const execResults = new Map()
    let resultPassed = 0, resultFailed = 0
    const execsWithResults = new Set()
    await Promise.all(
      execs.map(async exec => {
        const results = await fetchTestResults(exec.id).catch(() => [])
        execResults.set(exec.id, results)
        if (results.length > 0) {
          if (inProgressIds.has(exec.id)) execsWithResults.add(exec.id)
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
    // Suppress IN_PROGRESS with no results - not actionable signal.
    inProgress = 0

    day.tests = { passed, failed, inProgress, notStarted }
    day.builds = rawBuilds
      .map(b => ({
        ...b,
        test_executions: (b.test_executions ?? [])
          .filter(te => te.test_plan !== 'Image build')
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
    ratePct >= 70 ? 'var(--mc-positive)'
    : ratePct >= 40 ? 'var(--mc-caution)'
    : 'var(--mc-negative)',
  )

  // Currently selected day object
  let selDay = $derived(selectedDay !== null ? (days[selectedDay] ?? null) : null)

  // Notify parent whenever the viewed artefact changes (used to update details strip)
  $effect(() => { onArtefactChange?.(selDay?.artefact ?? null) })

  // ── Detail panel helpers ────────────────────────────────────────────

  /**
   * Group all test executions from a set of builds by environment name,
   * then flatten their results into a single row list per group.
   *
   * Each group: { envName, status, rows[], multiplePlans }
   *   rows: { tester, testName, plan, status, comment }
   *   multiplePlans: true when >1 distinct test_plan in the group
   *     (drives whether the "Test Plan" column is shown)
   *
   * Group status is the worst status across all executions:
   *   FAILED > IN_PROGRESS > NOT_STARTED > PASSED
   */
  function groupExecsByEnv(builds) {
    const groups = new Map()
    for (const build of builds) {
      for (const exec of build.test_executions) {
        const key = exec.environment?.name ?? 'Manual Testing'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(exec)
      }
    }

    const STATUS_RANK = { FAILED: 0, ENDED_PREMATURELY: 0, IN_PROGRESS: 1,
                          NOT_STARTED: 2, NOT_TESTED: 2, PASSED: 3 }

    return [...groups.entries()].map(([envName, execs]) => {
      const plans = new Set(execs.map(e => e.test_plan).filter(Boolean))
      const multiplePlans = plans.size > 1

      const rows = execs.flatMap(exec => {
        const effStatus = effectiveExecStatus(exec)
        const endedPrematurely = exec.status === 'ENDED_PREMATURELY'
        if (exec.results.length === 0) {
          return [{
            tester: null,
            testName: null,
            plan: exec.test_plan ?? null,
            status: effStatus,
            comment: null,
            noResults: true,
          }]
        }
        return exec.results.map(r => {
          const { tester, testName } = parseResultName(r.name)
          return {
            tester,
            testName,
            plan: exec.test_plan ?? null,
            // If the execution was cut short, surface that on the row
            // rather than whatever partial result status was recorded.
            status: endedPrematurely ? 'ENDED_PREMATURELY' : r.status,
            comment: r.comment ?? null,
            noResults: false,
          }
        })
      })

      // Group status derived from result rows where available,
      // falling back to exec-level status only when no results exist.
      // This avoids ENDED_PREMATURELY bubbling up when results are present.
      const resultRows = rows.filter(r => !r.noResults)
      let groupStatus
      if (resultRows.length > 0) {
        const statuses = resultRows.map(r => r.status)
        if (statuses.some(s => s === 'FAILED'))       groupStatus = 'FAILED'
        else if (statuses.every(s => s === 'PASSED'))  groupStatus = 'PASSED'
        else if (statuses.every(s => s === 'SKIPPED')) groupStatus = 'SKIPPED'
        else                                           groupStatus = 'IN_PROGRESS'
      } else {
        groupStatus = execs.reduce((worst, exec) => {
          const s = effectiveExecStatus(exec)
          return (STATUS_RANK[s] ?? 99) < (STATUS_RANK[worst] ?? 99) ? s : worst
        }, 'PASSED')
      }

      return { envName, status: groupStatus, rows, multiplePlans }
    })
  }

  function parseResultName(name) {
    if (!name) return { tester: null, testName: '—' }
    const idx = name.indexOf(' - ')
    if (idx === -1) return { tester: null, testName: name }
    return { tester: name.slice(0, idx), testName: name.slice(idx + 3) }
  }

  /** Vanilla p-status-label class for a tone ('' = neutral). */
  function statusLabel(tone) {
    return tone ? `p-status-label--${tone}` : 'p-status-label'
  }

  function execStatusTone(status) {
    if (status === 'PASSED')                                   return 'positive'
    if (['FAILED', 'ENDED_PREMATURELY'].includes(status))     return 'negative'
    if (status === 'IN_PROGRESS')                              return 'information'
    return ''
  }

  function resultStatusClass(status) {
    if (status === 'PASSED') return 'res-pass'
    if (['FAILED', 'ENDED_PREMATURELY'].includes(status)) return 'res-fail'
    return 'res-other'
  }

  function artefactStatusTone(status) {
    if (status === 'APPROVED')          return 'positive'
    if (status === 'MARKED_AS_FAILED')  return 'negative'
    return ''
  }

  const RESULT_TONES = { 'res-pass': 'positive', 'res-fail': 'negative' }

  /**
   * When a test execution is still IN_PROGRESS but all results have been submitted,
   * derive the effective status from the actual results rather than the stale
   * API status (testers often forget to formally close the execution).
   */
  function effectiveExecStatus(exec) {
    if (exec.status === 'IN_PROGRESS' && exec.results?.length > 0) {
      const nonSkipped = exec.results.filter(r => r.status !== 'SKIPPED')
      if (nonSkipped.length > 0) {
        if (nonSkipped.every(r => r.status === 'PASSED')) return 'PASSED'
        if (nonSkipped.some(r => r.status === 'FAILED'))  return 'FAILED'
      }
    }
    return exec.status
  }
</script>

<div class="history-panel">
  {#if showCalendar}
    <!-- ── Summary header ────────────────────────────────────────── -->
    {#if !loading && !error && rate}
      <div class="summary">
        <div class="summary-left">
          <span class="mc-label">30-day build history</span>
          <span class="u-text--muted">{rate.built} of {rate.total} days built · {rate.approved} approved</span>
        </div>
        <div class="rate-wrap">
          <span class="rate-label" style="color: {rateColor}">{ratePct}%</span>
          <div class="rate-track">
            <div class="rate-fill" style="width: {ratePct}%; background: {rateColor}"></div>
          </div>
          <span class="u-text--muted">build rate</span>
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
                        class:mc-text--positive={chunk.endsWith('✓')}
                        class:mc-text--negative={chunk.endsWith('✗')}
                        class:mc-text--information={chunk.endsWith('…')}
                  >{chunk}</span>
                {/each}
              {:else if day.artefact}
                <span class="u-text--muted">—</span>
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
        <span class="leg-item leg-hint u-text--muted">Click a day to see its test results</span>
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
          <span class={statusLabel(artefactStatusTone(selDay.artefact?.status))}>
            {STATUS_LABELS[selDay.artefact?.status] ?? '—'}
          </span>
        </div>
        {#if selDay.tests}
          <div class="detail-counts">
            {#if selDay.tests.passed}
              <span class="p-chip--positive is-dense is-readonly">
                <span class="p-chip__value">✓ {selDay.tests.passed}</span>
              </span>
            {/if}
            {#if selDay.tests.failed}
              <span class="p-chip--negative is-dense is-readonly">
                <span class="p-chip__value">✗ {selDay.tests.failed}</span>
              </span>
            {/if}
            {#if selDay.tests.inProgress}
              <span class="p-chip--information is-dense is-readonly">
                <span class="p-chip__value">… {selDay.tests.inProgress}</span>
              </span>
            {/if}
            {#if selDay.tests.notStarted}
              <span class="p-chip is-dense is-readonly">
                <span class="p-chip__value">○ {selDay.tests.notStarted}</span>
              </span>
            {/if}
            {#if selDay.tests.passed + selDay.tests.failed + selDay.tests.inProgress + selDay.tests.notStarted === 0}
              <span class="u-text--muted">no executions</span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Executions + results, grouped by environment -->
      {#if !selDay.builds || selDay.builds.length === 0}
        <div class="detail-empty">No test executions for this build.</div>
      {:else}
        {#each groupExecsByEnv(selDay.builds) as group}
          <div class="det-env-group">
            <div class="det-env-hdr">
              <span>{group.envName}</span>
              <span class={statusLabel(execStatusTone(group.status))}>
                {group.status ?? '—'}
              </span>
            </div>

            {#if group.rows.every(r => r.noResults)}
              <div class="det-no-results">No results submitted yet.</div>
            {:else}
              <table class="mc-table det-table">
                <thead>
                  <tr>
                    {#if group.multiplePlans}<th>Test Plan</th>{/if}
                    <th>Tester</th>
                    <th>Test</th>
                    <th>Status</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {#each group.rows as r}
                    {#if r.noResults}
                      <tr class="res-other">
                        {#if group.multiplePlans}<td class="det-plan-col">{r.plan ?? '—'}</td>{/if}
                        <td colspan="4" class="det-no-results-inline">No results submitted yet.</td>
                      </tr>
                    {:else}
                      <tr class={resultStatusClass(r.status)}>
                        {#if group.multiplePlans}<td class="det-plan-col">{r.plan ?? '—'}</td>{/if}
                        <td class="det-tester">{r.tester ?? '—'}</td>
                        <td class="det-name">{r.testName}</td>
                        <td>
                          <span class={statusLabel(RESULT_TONES[resultStatusClass(r.status)])}>
                            {r.status ?? '—'}
                          </span>
                        </td>
                        <td class="det-comment">{r.comment ?? ''}</td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
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
    padding: 1rem 0 0.5rem;
    --mc-built: color-mix(in srgb, var(--mc-positive) 30%, transparent);
    --mc-miss: color-mix(in srgb, var(--mc-negative) 30%, transparent);
  }

  /* ── Summary ──────────────────────────────────────────────────── */
  .summary {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: space-between;
  }

  .summary-left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .rate-wrap {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }

  .rate-label {
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
    min-width: 3.25rem;
    text-align: right;
  }

  .rate-track {
    background: var(--vf-color-background-neutral-default);
    height: 0.5rem;
    overflow: hidden;
    width: 7rem;
  }

  .rate-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  /* ── State message ────────────────────────────────────────────── */
  .hist-state {
    color: var(--vf-color-text-muted);
    padding: 1.25rem 0;
    text-align: center;
  }
  .hist-state.err { color: var(--mc-negative); }

  /* ── Day grid ─────────────────────────────────────────────────── */
  .day-grid {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    padding: 0.25rem;
  }

  .day-col {
    align-items: center;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 3px;
    width: 2rem;
  }

  /* Today: brand ring */
  .day-col.today .day-block {
    outline: 2px solid var(--mc-brand);
    outline-offset: 1px;
  }

  /* Selected: high-contrast ring, overrides today ring */
  .day-col.selected .day-block {
    outline: 2px solid var(--vf-color-text-default);
    outline-offset: 2px;
  }

  /* Test metrics line */
  .test-line {
    align-items: center;
    display: flex;
    font-size: 0.625rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    gap: 1px;
    height: 0.875rem;
    justify-content: center;
  }

  .tl-chip {
    line-height: 1.3;
    padding: 0 1px;
  }

  /* Status block */
  .day-block {
    align-items: center;
    border: none;
    border-radius: 0;
    color: inherit;
    cursor: default;
    display: flex;
    font-weight: 700;
    height: 2.375rem;
    justify-content: center;
    margin: 0;
    padding: 0;
    transition: transform 0.1s, filter 0.1s;
    width: 2rem;
  }
  .day-block.clickable         { cursor: pointer; }
  .day-block.clickable:hover   { transform: scaleY(1.08); }

  .day-block.built { background: var(--mc-built); }
  .day-block.miss  { background: var(--mc-miss); }

  .day-mark { line-height: 1; }
  .mark-ok   { color: var(--mc-positive); }
  .mark-fail { color: var(--mc-negative); }

  /* Date label */
  .day-label {
    color: var(--vf-color-text-muted);
    font-size: 0.5625rem;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
  }

  .today-label {
    color: var(--mc-brand);
    font-weight: 700;
  }

  /* ── Legend ───────────────────────────────────────────────────── */
  .legend {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    font-size: 0.875rem;
    gap: 1.25rem;
  }

  .leg-item {
    align-items: center;
    display: flex;
    gap: 0.375rem;
  }

  .leg-hint {
    font-style: italic;
    margin-left: auto;
  }

  .leg-swatch {
    flex-shrink: 0;
    height: 0.75rem;
    width: 0.75rem;
  }
  .leg-swatch.built { background: var(--mc-built); }
  .leg-swatch.miss  { background: var(--mc-miss); }
  .leg-mark { font-weight: 700; }

  /* ── Detail panel ─────────────────────────────────────────────── */
  .detail-panel {
    border: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-direction: column;
  }

  .detail-hdr {
    align-items: center;
    background: var(--vf-color-background-alt);
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    padding: 0.75rem 1rem;
  }

  .detail-hdr-left {
    align-items: center;
    display: flex;
    gap: 0.75rem;
  }

  .detail-date {
    font-weight: 550;
  }

  .detail-version {
    color: var(--vf-color-text-muted);
    font-family: var(--mc-font-mono);
  }

  .detail-counts {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .detail-counts [class*='p-chip'] {
    margin: 0;
  }

  .detail-empty {
    color: var(--vf-color-text-muted);
    font-style: italic;
    padding: 1rem;
  }

  /* ── Execution blocks ─────────────────────────────────────────── */
  .det-env-group {
    border-top: 1px solid var(--vf-color-border-low-contrast);
  }
  .det-env-group:first-child { border-top: none; }

  .det-env-hdr {
    align-items: center;
    background: var(--vf-color-background-neutral-default);
    display: flex;
    font-size: 0.875rem;
    font-weight: 550;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.5rem 1rem;
  }

  .det-no-results {
    color: var(--vf-color-text-muted);
    font-style: italic;
    padding: 0.5rem 1rem;
  }

  .det-no-results-inline {
    color: var(--vf-color-text-muted);
    font-style: italic;
  }

  /* ── Results table ────────────────────────────────────────────── */
  .det-table th:first-child,
  .det-table td:first-child {
    padding-left: 1rem;
  }

  .det-table td {
    vertical-align: top;
  }

  .det-plan-col { color: var(--vf-color-text-muted); white-space: nowrap; }
  .res-pass td { background: var(--vf-color-background-positive-default); }
  .res-fail td { background: var(--vf-color-background-negative-default); }

  .det-tester  { color: var(--vf-color-text-muted); white-space: nowrap; }
  .det-comment { color: var(--vf-color-text-muted); font-style: italic; }
</style>
