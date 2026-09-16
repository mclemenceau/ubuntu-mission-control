<script>
  import { onMount } from 'svelte'
  import { fmtDate } from '../lib/utils.js'
  import { clearCache } from '../api/client.js'
  import BugPanel from './BugPanel.svelte'
  import {
    buildTestingDataset,
    computeTestingKpis,
    groupByDate,
    groupByArtifact,
    groupByTester,
    getUniqueOS,
    getUniqueTesters,
    dateNDaysAgo,
  } from '../lib/testingProcessor.js'

  let { releases = [], selectedRelease = null } = $props()

  // ── Filters ──────────────────────────────────────────────────────
  let timeframeDays = $state(7)
  let filterOS      = $state('')
  let filterTester  = $state('')

  // ── Data state ───────────────────────────────────────────────────
  let rawEntries = $state([])
  let loadLabel  = $state('')
  let loadPct    = $state(0)
  let isLoading  = $state(false)
  let loadError  = $state(null)

  // ── Derived filter options (populated once data is loaded) ───────
  let availableOS      = $derived(getUniqueOS(rawEntries))
  let availableTesters = $derived(getUniqueTesters(rawEntries))

  // ── Apply client-side filters ────────────────────────────────────
  let entries = $derived.by(() => {
    let e = rawEntries
    if (filterOS)     e = e.filter(x => x.os === filterOS)
    if (filterTester) e = e.filter(x => x.tester === filterTester)
    return e
  })

  // ── KPIs and groupings ───────────────────────────────────────────
  let dateFrom = $derived(dateNDaysAgo(timeframeDays))
  let dateTo   = $derived(fmtDate(new Date()))

  let kpis       = $derived(computeTestingKpis(entries))
  let byDate     = $derived(groupByDate(entries, dateFrom, dateTo))
  let byArtifact = $derived(groupByArtifact(entries))

  // ── Tester table mode ─────────────────────────────────────────────
  let testerMode = $state('all')   // 'all' | 'manual' | 'automated'
  let byTester   = $derived(groupByTester(entries, testerMode))

  // Max daily total for chart scaling
  let chartMax = $derived(Math.max(1, ...byDate.map(d => d.passed + d.failed)))

  // ── Bug panel ────────────────────────────────────────────────────
  let bugPanelOpen = $state(false)

  let bugList = $derived.by(() => {
    const map = new Map()
    for (const e of entries) {
      for (const bugId of e.bugs) {
        if (!map.has(bugId)) {
          map.set(bugId, { id: bugId, artifacts: new Set(), testers: new Set() })
        }
        const b = map.get(bugId)
        b.artifacts.add(e.displayName || e.artefactName)
        b.testers.add(e.tester)
      }
    }
    return [...map.values()]
      .map(b => ({
        id: b.id,
        artifacts: [...b.artifacts].sort().join(', '),
        testers: [...b.testers].filter(Boolean).sort().join(', '),
        url: `https://bugs.launchpad.net/bugs/${b.id}`,
      }))
      .sort((a, b) => Number(b.id) - Number(a.id))
  })

  // ── Data loading ─────────────────────────────────────────────────
  let _loading = false

  async function loadData(force = false) {
    if (_loading) return
    _loading  = true
    isLoading = true
    loadError = null
    if (force) clearCache()
    loadPct   = 0
    rawEntries = []
    filterOS     = ''
    filterTester = ''

    try {
      rawEntries = await buildTestingDataset(
        { release: selectedRelease?.release ?? '', dateFrom, dateTo },
        ({ label, pct }) => {
          loadLabel = label
          loadPct   = pct
        },
      )
    } catch (err) {
      console.error('Testing page error:', err)
      loadError = err.message
    } finally {
      _loading  = false
      isLoading = false
    }
  }

  // Reload when the shared release selector changes
  let _prevRelease = null
  $effect(() => {
    const rel = selectedRelease?.release ?? null
    if (rel !== _prevRelease) {
      _prevRelease = rel
      loadData()
    }
  })

  onMount(() => {
    _prevRelease = selectedRelease?.release ?? null
    loadData()
  })

  // ── Helpers ──────────────────────────────────────────────────────
  function pctColorClass(pct) {
    if (pct === null || pct === undefined) return 'neutral'
    if (pct >= 80) return 'green'
    if (pct >= 50) return 'amber'
    return 'red'
  }

  function shortDate(iso) {
    // "2026-04-15" → "Apr 15"
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }

  const TIMEFRAMES = [7, 14, 30, 60, 90]
</script>

<BugPanel open={bugPanelOpen} bugs={bugList} onClose={() => bugPanelOpen = false} />

<div class="testing-page">

  <!-- ── Filter bar ────────────────────────────────────────── -->
  <div class="filter-bar">
    <div class="filter-group">
      <span class="filter-label">Timeframe</span>
      <div class="pill-row">
        {#each TIMEFRAMES as days}
          <button
            class="pill"
            class:active={timeframeDays === days}
            onclick={() => { timeframeDays = days; loadData() }}
          >{days}d</button>
        {/each}
      </div>
    </div>

    <span class="filter-sep">|</span>

    <div class="filter-group">
      <span class="filter-label">OS</span>
      <select bind:value={filterOS} disabled={isLoading || availableOS.length === 0}>
        <option value="">All</option>
        {#each availableOS as os}
          <option value={os}>{os}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">Tester</span>
      <select bind:value={filterTester} disabled={isLoading || availableTesters.length === 0}>
        <option value="">All testers</option>
        {#each availableTesters as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </div>

    <div class="filter-meta">
      {dateFrom} → {dateTo}
      {#if !isLoading && rawEntries.length > 0}
        · {entries.length} results
      {/if}
    </div>

    {#if !isLoading && rawEntries.length > 0}
      <button class="refresh-btn" onclick={() => loadData(true)} title="Refresh data">↺ Refresh</button>
    {/if}
  </div>

  <!-- ── Loading state ─────────────────────────────────────── -->
  {#if isLoading}
    <div class="loading-wrap">
      <div class="loading-box">
        <div class="loading-title">Loading Testing Data</div>
        <div class="loading-label">{loadLabel}</div>
        <div class="loading-track">
          <div class="loading-fill" style="width: {loadPct}%"></div>
        </div>
        <div class="loading-pct">{loadPct}%</div>
      </div>
    </div>

  <!-- ── Error state ────────────────────────────────────────── -->
  {:else if loadError}
    <div class="error-msg">Error: {loadError}</div>

  <!-- ── Empty state ────────────────────────────────────────── -->
  {:else if rawEntries.length === 0}
    <div class="empty-state">
      <div class="empty-icon">◎</div>
      <div class="empty-title">No test results found</div>
      <div class="empty-sub">
        No manual test executions recorded for
        {selectedRelease?.release ?? 'the selected release'}
        in the last {timeframeDays} days.
      </div>
    </div>

  <!-- ── Main content ───────────────────────────────────────── -->
  {:else}

    <!-- KPI strip -->
    <div class="kpi-strip">
      <div class="kpi-card">
        <div class="kpi-value">{kpis.total}</div>
        <div class="kpi-label">Test Results</div>
        <div class="kpi-sub">{kpis.executions} execution{kpis.executions !== 1 ? 's' : ''}</div>
      </div>

      <div class="kpi-card {pctColorClass(kpis.passRate)}">
        <div class="kpi-value">{kpis.passRate !== null ? kpis.passRate + '%' : '—'}</div>
        <div class="kpi-label">Pass Rate</div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar-fill" style="width: {kpis.passRate ?? 0}%"></div>
        </div>
        <div class="kpi-sub">{kpis.passed} passed / {kpis.failed} failed</div>
      </div>

      <div class="kpi-card {kpis.failed > 0 ? 'red' : 'neutral'}">
        <div class="kpi-value">{kpis.failed}</div>
        <div class="kpi-label">Failures</div>
        <div class="kpi-sub">
          {kpis.total > 0 ? Math.round((kpis.failed / kpis.total) * 100) : 0}% of tests
        </div>
      </div>

      <button
        class="kpi-card kpi-card--btn {kpis.bugs === 0 ? 'green' : kpis.bugs <= 3 ? 'amber' : 'red'}"
        onclick={() => bugPanelOpen = true}
        disabled={kpis.bugs === 0}
        title={kpis.bugs > 0 ? 'View filed bugs' : undefined}
      >
        <div class="kpi-value">{kpis.bugs}</div>
        <div class="kpi-label">Bugs Filed</div>
        <div class="kpi-sub">unique LP bugs</div>
      </button>

      <div class="kpi-card blue">
        <div class="kpi-value">{kpis.testers}</div>
        <div class="kpi-label">Active Testers</div>
        <div class="kpi-sub">{kpis.artifacts} artifact{kpis.artifacts !== 1 ? 's' : ''} covered</div>
      </div>
    </div>

    <!-- Trend chart -->
    <div class="section">
      <div class="section-title">Daily Trend — {dateFrom} to {dateTo}</div>
      <div class="chart">
        {#each byDate as day}
          {@const total = day.passed + day.failed}
          {@const barH = chartMax > 0 ? Math.round((total / chartMax) * 100) : 0}
          <div class="chart-col" title="{shortDate(day.date)}: {day.passed + day.failed} tests ({day.passed} passed, {day.failed} failed)">
            <div class="chart-bar-area">
              {#if total > 0}
                <div class="chart-bar" style="height: {barH}%">
                  <div class="seg seg-failed"  style="flex: {day.failed}"></div>
                  <div class="seg seg-passed"  style="flex: {day.passed}"></div>
                </div>
              {:else}
                <div class="chart-bar chart-bar--empty" style="height: 2px; bottom: 0; position: absolute; width: 100%"></div>
              {/if}
            </div>
            <div class="chart-date">{shortDate(day.date)}</div>
          </div>
        {/each}
      </div>
      <div class="chart-legend">
        <span class="legend-item passed">● Passed</span>
        <span class="legend-item failed">● Failed</span>
      </div>
    </div>

    <!-- Two-column breakdown -->
    <div class="breakdown-row">

      <!-- Artifact breakdown -->
      <div class="breakdown-panel">
        <div class="section-title">By Artifact</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Artifact</th>
                <th class="num-col">Pass</th>
                <th class="num-col">Fail</th>
                <th class="num-col">Rate</th>
                <th class="num-col">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {#each byArtifact as row}
                <tr>
                  <td>
                    <span class="art-name">{row.displayName}</span>
                    {#if row.arch}
                      <span class="art-arch">{row.arch}</span>
                    {/if}
                  </td>
                  <td class="num-col green-text">{row.passed}</td>
                  <td class="num-col {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                  <td class="num-col">
                    {#if row.passRate !== null}
                      <span class="rate-badge {pctColorClass(row.passRate)}">{row.passRate}%</span>
                    {:else}
                      <span class="dim-text">—</span>
                    {/if}
                  </td>
                  <td class="num-col {row.bugs > 0 ? 'amber-text' : 'dim-text'}">{row.bugs}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tester breakdown -->
      <div class="breakdown-panel">
        <div class="section-title-row">
          <span class="section-title">By Tester</span>
          <div class="mode-pills">
            <button class="mode-pill" class:active={testerMode === 'all'}        onclick={() => testerMode = 'all'}>All</button>
            <button class="mode-pill" class:active={testerMode === 'manual'}     onclick={() => testerMode = 'manual'}>Manual</button>
            <button class="mode-pill" class:active={testerMode === 'automated'}  onclick={() => testerMode = 'automated'}>Automated</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tester</th>
                <th class="num-col">Total</th>
                <th class="num-col">Pass</th>
                <th class="num-col">Fail</th>
                <th class="num-col">Rate</th>
                <th class="num-col">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {#each byTester as row}
                <tr>
                  <td class="tester-name">{row.tester}</td>
                  <td class="num-col">{row.total}</td>
                  <td class="num-col green-text">{row.passed}</td>
                  <td class="num-col {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                  <td class="num-col">
                    {#if row.passRate !== null}
                      <span class="rate-badge {pctColorClass(row.passRate)}">{row.passRate}%</span>
                    {:else}
                      <span class="dim-text">—</span>
                    {/if}
                  </td>
                  <td class="num-col {row.bugs > 0 ? 'amber-text' : 'dim-text'}">{row.bugs}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

    </div>

  {/if}
</div>

<style>
  .testing-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem 1rem;
    min-height: 0;
  }

  /* ── Filter bar ──────────────────────────────────────────── */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    background: var(--bg-panel);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 0.55rem 1rem;
    flex-shrink: 0;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .filter-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .pill-row {
    display: flex;
    gap: 0.25rem;
  }

  .pill {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.15rem 0.55rem;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .pill:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 700;
  }

  .filter-sep {
    color: var(--border-strong);
    user-select: none;
  }

  select {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text);
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    max-width: 200px;
  }
  select:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .filter-meta {
    margin-left: auto;
    font-size: 0.8rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .refresh-btn {
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 0.82rem;
    font-family: inherit;
    padding: 0.2rem 0.65rem;
    border-radius: 4px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .refresh-btn:hover {
    color: var(--text);
    border-color: var(--accent);
  }

  /* ── Loading ─────────────────────────────────────────────── */
  .loading-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 200px;
  }

  .loading-box {
    background: var(--bg-panel);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 2rem 3rem;
    text-align: center;
    min-width: 320px;
  }

  .loading-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .loading-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    min-height: 1.25em;
  }

  .loading-track {
    height: 4px;
    background: var(--bg-raised);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .loading-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .loading-pct {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  /* ── Error / empty ───────────────────────────────────────── */
  .error-msg {
    color: var(--red);
    padding: 1rem 1.5rem;
    font-size: 0.875rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 0.5rem;
    min-height: 200px;
    text-align: center;
    padding: 2rem;
  }
  .empty-icon {
    font-size: 2.5rem;
    color: var(--border-strong);
  }
  .empty-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  .empty-sub {
    font-size: 0.875rem;
    color: var(--text-dim);
    max-width: 420px;
  }

  /* ── KPI strip ───────────────────────────────────────────── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .kpi-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    transition: border-color 0.2s;
  }

  .kpi-card--btn {
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .kpi-card--btn:not(:disabled):hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
  .kpi-card--btn:disabled {
    cursor: default;
  }
  .kpi-card.green { border-left: 3px solid var(--green); }
  .kpi-card.amber { border-left: 3px solid var(--amber); }
  .kpi-card.red   { border-left: 3px solid var(--red);   }
  .kpi-card.blue  { border-left: 3px solid var(--blue);  }

  .kpi-value {
    font-size: 1.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    line-height: 1;
  }
  .kpi-card.green .kpi-value { color: var(--green); }
  .kpi-card.amber .kpi-value { color: var(--amber); }
  .kpi-card.red   .kpi-value { color: var(--red);   }
  .kpi-card.blue  .kpi-value { color: var(--blue);  }

  .kpi-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }

  .kpi-bar-wrap {
    height: 3px;
    background: var(--bg-raised);
    border-radius: 2px;
    overflow: hidden;
    margin: 0.15rem 0;
  }
  .kpi-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }
  .kpi-card.green .kpi-bar-fill { background: var(--green); }
  .kpi-card.amber .kpi-bar-fill { background: var(--amber); }
  .kpi-card.red   .kpi-bar-fill { background: var(--red);   }

  .kpi-sub {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  /* ── Section headers ─────────────────────────────────────── */
  .section {
    background: var(--bg-panel);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 1rem;
    flex-shrink: 0;
  }

  .section-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 0.85rem;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }
  .section-title-row .section-title {
    margin-bottom: 0;
  }

  .mode-pills {
    display: flex;
    gap: 0.2rem;
  }

  .mode-pill {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .mode-pill:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .mode-pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  /* ── Trend chart ─────────────────────────────────────────── */
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 120px;
    padding-bottom: 1.6rem;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .chart-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 22px;
    height: 100%;
    position: relative;
  }

  .chart-bar-area {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    position: relative;
  }

  .chart-bar {
    width: 100%;
    display: flex;
    flex-direction: column-reverse;
    border-radius: 2px 2px 0 0;
    overflow: hidden;
    min-height: 2px;
  }

  .seg {
    min-height: 1px;
  }
  .seg-passed { background: var(--green); }
  .seg-failed { background: var(--red); }

  .chart-date {
    position: absolute;
    bottom: -1.5rem;
    font-size: 0.62rem;
    color: var(--text-dim);
    white-space: nowrap;
    transform: translateX(-50%);
    left: 50%;
  }

  /* Show date labels only for every Nth column to avoid overlap */
  .chart-col:nth-child(7n+1) .chart-date { display: block; }
  .chart-col:not(:nth-child(7n+1)) .chart-date { display: none; }

  .chart-legend {
    display: flex;
    gap: 1.25rem;
    margin-top: 0.5rem;
    font-size: 0.78rem;
  }
  .legend-item.passed { color: var(--green); }
  .legend-item.failed { color: var(--red); }

  /* ── Breakdown row ───────────────────────────────────────── */
  .breakdown-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .breakdown-panel {
    background: var(--bg-panel);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 1rem;
    overflow: hidden;
  }

  .table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 320px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.83rem;
  }

  thead tr {
    border-bottom: 1px solid var(--border-mid);
  }

  th {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-dim);
    padding: 0.3rem 0.5rem;
    text-align: left;
    position: sticky;
    top: 0;
    background: var(--bg-panel);
  }

  td {
    padding: 0.35rem 0.5rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover td {
    background: var(--surface-faint);
  }

  .num-col {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    width: 1%;
  }

  .art-name {
    color: var(--text);
    font-weight: 600;
  }
  .art-arch {
    margin-left: 0.35rem;
    font-size: 0.72rem;
    color: var(--text-dim);
    background: var(--bg-raised);
    padding: 0.05rem 0.35rem;
    border-radius: 3px;
  }

  .tester-name {
    color: var(--text);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rate-badge {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .rate-badge.green  { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
  .rate-badge.amber  { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
  .rate-badge.red    { background: var(--red-bg);   color: var(--red);   border: 1px solid var(--red-border);   }
  .rate-badge.neutral { color: var(--text-dim); }

  .green-text { color: var(--green); }
  .amber-text { color: var(--amber); }
  .red-text   { color: var(--red);   }
  .dim-text   { color: var(--text-dim); }
</style>
