<script>
  import { onMount } from 'svelte'
  import { fmtDate, pctColor } from '../lib/utils.js'
  import { clearCache } from '../api/client.js'
  import BugPanel from './BugPanel.svelte'
  import KpiCard from './KpiCard.svelte'
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
  function shortDate(iso) {
    // "2026-04-15" → "Apr 15"
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }

  const TIMEFRAMES = [7, 14, 30, 60, 90]

  const TESTER_MODES = [
    { id: 'all',       label: 'All'       },
    { id: 'manual',    label: 'Manual'    },
    { id: 'automated', label: 'Automated' },
  ]
</script>

<BugPanel open={bugPanelOpen} bugs={bugList} onClose={() => bugPanelOpen = false} />

<div class="testing-page">

  <!-- ── Filter bar ────────────────────────────────────────── -->
  <div class="mc-surface filter-bar">
    <div class="filter-group">
      <span class="mc-label">Timeframe</span>
      <div class="p-segmented-control is-dense">
        <div class="p-segmented-control__list" role="tablist" aria-label="Timeframe">
          {#each TIMEFRAMES as days}
            <button
              class="p-segmented-control__button"
              role="tab"
              aria-selected={timeframeDays === days}
              onclick={() => { timeframeDays = days; loadData() }}
            >{days}d</button>
          {/each}
        </div>
      </div>
    </div>

    <div class="filter-group">
      <label class="mc-label" for="filter-os">OS</label>
      <select
        id="filter-os"
        bind:value={filterOS}
        disabled={isLoading || availableOS.length === 0}
      >
        <option value="">All</option>
        {#each availableOS as os}
          <option value={os}>{os}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label class="mc-label" for="filter-tester">Tester</label>
      <select
        id="filter-tester"
        bind:value={filterTester}
        disabled={isLoading || availableTesters.length === 0}
      >
        <option value="">All testers</option>
        {#each availableTesters as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </div>

    <div class="filter-meta u-text--muted">
      {dateFrom} → {dateTo}
      {#if !isLoading && rawEntries.length > 0}
        · {entries.length} results
      {/if}
    </div>

    {#if !isLoading && rawEntries.length > 0}
      <button
        class="p-button is-dense has-icon"
        onclick={() => loadData(true)}
        title="Refresh data"
      ><i class="p-icon--restart"></i><span>Refresh</span></button>
    {/if}
  </div>

  <!-- ── Loading state ─────────────────────────────────────── -->
  {#if isLoading}
    <div class="loading-wrap">
      <div class="mc-surface loading-box">
        <h2 class="mc-label">Loading testing data</h2>
        <p class="u-text--muted">{loadLabel}</p>
        <div class="mc-progress" style="--mc-bar: var(--mc-brand)">
          <span style="width: {loadPct}%"></span>
        </div>
        <p class="u-text--muted loading-pct">{loadPct}%</p>
      </div>
    </div>

  <!-- ── Error state ────────────────────────────────────────── -->
  {:else if loadError}
    <div class="p-notification--negative">
      <div class="p-notification__content">
        <h5 class="p-notification__title">Error</h5>
        <p class="p-notification__message">{loadError}</p>
      </div>
    </div>

  <!-- ── Empty state ────────────────────────────────────────── -->
  {:else if rawEntries.length === 0}
    <div class="empty-state">
      <h3 class="p-heading--5">No test results found</h3>
      <p class="u-text--muted">
        No manual test executions recorded for
        {selectedRelease?.release ?? 'the selected release'}
        in the last {timeframeDays} days.
      </p>
    </div>

  <!-- ── Main content ───────────────────────────────────────── -->
  {:else}

    <!-- KPI strip -->
    <div class="mc-surface kpi-strip">
      <KpiCard
        label="Test results"
        value={kpis.total}
        sub="{kpis.executions} execution{kpis.executions !== 1 ? 's' : ''}"
        pct={null}
      />
      <KpiCard
        label="Pass rate"
        value={kpis.passRate !== null ? kpis.passRate + '%' : '—'}
        sub="{kpis.passed} passed / {kpis.failed} failed"
        pct={kpis.passRate}
        tone={pctColor(kpis.passRate)}
      />
      <KpiCard
        label="Failures"
        value={kpis.failed}
        sub="{kpis.total > 0
          ? Math.round((kpis.failed / kpis.total) * 100) : 0}% of tests"
        pct={null}
        tone={kpis.failed > 0 ? 'negative' : 'neutral'}
      />
      <KpiCard
        label="Bugs filed"
        value={kpis.bugs}
        sub="unique LP bugs"
        pct={null}
        tone={kpis.bugs === 0 ? 'positive' : kpis.bugs <= 3 ? 'caution' : 'negative'}
        onclick={kpis.bugs > 0 ? () => bugPanelOpen = true : null}
      />
      <KpiCard
        label="Active testers"
        value={kpis.testers}
        sub="{kpis.artifacts} artifact{kpis.artifacts !== 1 ? 's' : ''} covered"
        pct={null}
        tone="information"
      />
    </div>

    <!-- Trend chart -->
    <section class="mc-surface">
      <h2 class="mc-label section-title">Daily trend — {dateFrom} to {dateTo}</h2>
      <div class="chart">
        {#each byDate as day}
          {@const total = day.passed + day.failed}
          {@const barH = chartMax > 0 ? Math.round((total / chartMax) * 100) : 0}
          <div
            class="chart-col"
            title="{shortDate(day.date)}: {total} tests ({day.passed} passed, {day.failed} failed)"
          >
            <div class="chart-bar-area">
              {#if total > 0}
                <div class="chart-bar" style="height: {barH}%">
                  <div class="seg seg-failed" style="flex: {day.failed}"></div>
                  <div class="seg seg-passed" style="flex: {day.passed}"></div>
                </div>
              {:else}
                <div class="chart-bar chart-bar--empty"></div>
              {/if}
            </div>
            <div class="chart-date">{shortDate(day.date)}</div>
          </div>
        {/each}
      </div>
      <div class="chart-legend">
        <span class="mc-text--positive">● Passed</span>
        <span class="mc-text--negative">● Failed</span>
      </div>
    </section>

    <!-- Two-column breakdown -->
    <div class="breakdown-row">

      <!-- Artifact breakdown -->
      <section class="mc-surface">
        <h2 class="mc-label section-title">By artifact</h2>
        <div class="table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>Artifact</th>
                <th class="is-numeric">Pass</th>
                <th class="is-numeric">Fail</th>
                <th class="is-numeric">Rate</th>
                <th class="is-numeric">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {#each byArtifact as row}
                <tr>
                  <td>
                    <strong>{row.displayName}</strong>
                    {#if row.arch}
                      <span class="u-text--muted art-arch">{row.arch}</span>
                    {/if}
                  </td>
                  <td class="is-numeric mc-text--positive">{row.passed}</td>
                  <td class="is-numeric"
                      class:mc-text--negative={row.failed > 0}
                      class:u-text--muted={row.failed === 0}>{row.failed}</td>
                  <td class="is-numeric">
                    {#if row.passRate !== null}
                      <span class="p-status-label--{pctColor(row.passRate)}">
                        {row.passRate}%
                      </span>
                    {:else}
                      <span class="u-text--muted">—</span>
                    {/if}
                  </td>
                  <td class="is-numeric"
                      class:mc-text--caution={row.bugs > 0}
                      class:u-text--muted={row.bugs === 0}>{row.bugs}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tester breakdown -->
      <section class="mc-surface">
        <div class="section-title-row">
          <h2 class="mc-label">By tester</h2>
          <div class="p-segmented-control is-dense">
            <div class="p-segmented-control__list" role="tablist" aria-label="Test type">
              {#each TESTER_MODES as mode}
                <button
                  class="p-segmented-control__button"
                  role="tab"
                  aria-selected={testerMode === mode.id}
                  onclick={() => testerMode = mode.id}
                >{mode.label}</button>
              {/each}
            </div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="mc-table">
            <thead>
              <tr>
                <th>Tester</th>
                <th class="is-numeric">Total</th>
                <th class="is-numeric">Pass</th>
                <th class="is-numeric">Fail</th>
                <th class="is-numeric">Rate</th>
                <th class="is-numeric">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {#each byTester as row}
                <tr>
                  <td class="u-truncate tester-name">{row.tester}</td>
                  <td class="is-numeric">{row.total}</td>
                  <td class="is-numeric mc-text--positive">{row.passed}</td>
                  <td class="is-numeric"
                      class:mc-text--negative={row.failed > 0}
                      class:u-text--muted={row.failed === 0}>{row.failed}</td>
                  <td class="is-numeric">
                    {#if row.passRate !== null}
                      <span class="p-status-label--{pctColor(row.passRate)}">
                        {row.passRate}%
                      </span>
                    {:else}
                      <span class="u-text--muted">—</span>
                    {/if}
                  </td>
                  <td class="is-numeric"
                      class:mc-text--caution={row.bugs > 0}
                      class:u-text--muted={row.bugs === 0}>{row.bugs}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

    </div>

  {/if}
</div>

<style>
  .testing-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    padding: 1rem 1.5rem;
  }

  /* ── Filter bar ──────────────────────────────────────────── */
  .filter-bar {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 1.5rem;
    padding: 0.5rem 1rem;
  }

  .filter-group {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }

  .filter-group .p-segmented-control__button {
    margin-bottom: 0;
  }

  .filter-group label {
    padding-top: 0;
  }

  select {
    margin: 0;
    max-width: 14rem;
    width: auto;
  }

  .filter-meta {
    font-size: 0.875rem;
    margin-left: auto;
    white-space: nowrap;
  }

  .filter-bar > button {
    margin: 0;
  }

  /* ── Loading ─────────────────────────────────────────────── */
  .loading-wrap {
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
    min-height: 12rem;
  }

  .loading-box {
    min-width: 20rem;
    padding: 2rem 3rem;
    text-align: center;
  }

  .loading-box .mc-label {
    margin-bottom: 1rem;
  }

  .loading-box p {
    margin-bottom: 0.75rem;
    min-height: 1.5rem;
  }

  .loading-box .loading-pct {
    font-size: 0.875rem;
    margin: 0.5rem 0 0;
  }

  /* ── Empty ───────────────────────────────────────────────── */
  .empty-state {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-height: 12rem;
    padding: 2rem;
    text-align: center;
  }

  .empty-state p {
    max-width: 26rem;
  }

  /* ── KPI strip ───────────────────────────────────────────── */
  .kpi-strip {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(5, 1fr);
    padding: 0;
  }

  .kpi-strip :global(.kpi:last-child) {
    border-right: none;
  }

  /* ── Section headers ─────────────────────────────────────── */
  .section-title {
    margin-bottom: 1rem;
  }

  .section-title-row {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .section-title-row .p-segmented-control__button {
    margin-bottom: 0;
  }

  /* ── Trend chart ─────────────────────────────────────────── */
  .chart {
    align-items: flex-end;
    display: flex;
    gap: 2px;
    height: 7.5rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 1.5rem;
    position: relative;
  }

  .chart-col {
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    height: 100%;
    min-width: 1.375rem;
    position: relative;
  }

  .chart-bar-area {
    align-items: flex-end;
    display: flex;
    flex: 1;
    position: relative;
    width: 100%;
  }

  .chart-bar {
    display: flex;
    flex-direction: column-reverse;
    min-height: 2px;
    overflow: hidden;
    width: 100%;
  }

  .chart-bar--empty {
    background: var(--vf-color-border-low-contrast);
    height: 2px;
  }

  .seg {
    min-height: 1px;
  }
  .seg-passed { background: var(--mc-positive); }
  .seg-failed { background: var(--mc-negative); }

  .chart-date {
    bottom: -1.5rem;
    color: var(--vf-color-text-muted);
    font-size: 0.625rem;
    left: 50%;
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  /* Show date labels only for every Nth column to avoid overlap */
  .chart-col:not(:nth-child(7n+1)) .chart-date { display: none; }

  .chart-legend {
    display: flex;
    font-size: 0.875rem;
    gap: 1.25rem;
    margin-top: 0.5rem;
  }

  /* ── Breakdown row ───────────────────────────────────────── */
  .breakdown-row {
    display: grid;
    flex-shrink: 0;
    gap: 1rem;
    grid-template-columns: 1fr 1fr;
  }

  .breakdown-row > section {
    min-width: 0;
  }

  .table-wrap {
    max-height: 20rem;
    overflow: auto;
  }

  .art-arch {
    font-size: 0.875rem;
    margin-left: 0.375rem;
  }

  .tester-name {
    max-width: 12.5rem;
  }
</style>
