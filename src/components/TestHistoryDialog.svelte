<script>
  import {
    buildTestingDataset,
    groupByDate,
    groupByArtifact,
    groupByTester,
    dateNDaysAgo,
  } from '../lib/testingProcessor.js'
  import { fmtDate } from '../lib/utils.js'

  /**
   * @type {{
   *   open: boolean,
   *   release: string,
   *   onClose: () => void,
   * }}
   */
  let { open = false, release = '', onClose = () => {} } = $props()

  // ── Period ────────────────────────────────────────────────────
  const PERIODS = [30, 60, 90]
  let period = $state(30)

  // ── Load state ────────────────────────────────────────────────
  let loading   = $state(false)
  let loadLabel = $state('')
  let loadPct   = $state(0)
  let error     = $state(null)
  let data      = $state(null)   // { entries, byDate, byArtifact, byTester, summary }

  // Cancel token: increment to abort an in-flight load
  let _loadGen = 0

  // ── Keyboard close ────────────────────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Escape') onClose()
  }

  // ── Load when dialog opens or period changes ──────────────────
  $effect(() => {
    if (!open) return
    // Access period inside effect so Svelte tracks it
    const p = period
    loadHistory(p)
  })

  async function loadHistory(p) {
    const gen = ++_loadGen
    loading   = true
    loadLabel = ''
    loadPct   = 0
    error     = null
    data      = null

    const dateFrom = dateNDaysAgo(p)
    const dateTo   = fmtDate(new Date())

    try {
      const entries = await buildTestingDataset(
        { release, dateFrom, dateTo },
        ({ label, pct }) => {
          if (gen !== _loadGen) return
          loadLabel = label
          loadPct   = pct
        },
      )
      if (gen !== _loadGen) return   // superseded by a newer load

      const passed = entries.filter(e => e.status === 'PASSED').length
      const failed = entries.filter(e => e.status === 'FAILED').length
      const total  = passed + failed

      data = {
        entries,
        byDate:     groupByDate(entries, dateFrom, dateTo),
        byArtifact: groupByArtifact(entries).slice(0, 10),
        byTester:   groupByTester(entries).slice(0, 10),
        summary:    {
          total,
          passed,
          failed,
          passRate: total > 0 ? Math.round((passed / total) * 100) : null,
          dateFrom,
          dateTo,
        },
      }
    } catch (err) {
      if (gen !== _loadGen) return
      console.error('TestHistoryDialog error:', err)
      error = err.message
    } finally {
      if (gen === _loadGen) loading = false
    }
  }

  function selectPeriod(p) {
    period = p
  }

  // ── Chart helpers ─────────────────────────────────────────────
  function shortDate(iso) {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }

  function pctColorClass(pct) {
    if (pct === null || pct === undefined) return 'neutral'
    if (pct >= 80) return 'green'
    if (pct >= 50) return 'amber'
    return 'red'
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- Backdrop -->
  <div class="backdrop" onclick={onClose} role="presentation"></div>

  <!-- Dialog -->
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Test History">

    <!-- Header -->
    <div class="dialog-header">
      <div class="dialog-title">Test History</div>

      <!-- Period pills -->
      <div class="period-row">
        {#each PERIODS as p}
          <button
            class="period-pill"
            class:active={period === p}
            onclick={() => selectPeriod(p)}
            disabled={loading}
          >{p}d</button>
        {/each}
      </div>

      {#if data}
        <div class="summary-pills">
          <span class="pill total">{data.summary.total} tests</span>
          <span class="pill passed">{data.summary.passed} passed</span>
          <span class="pill failed">{data.summary.failed} failed</span>
          {#if data.summary.passRate !== null}
            <span class="pill rate {pctColorClass(data.summary.passRate)}">
              {data.summary.passRate}% pass rate
            </span>
          {/if}
        </div>
      {/if}

      <button class="close-btn" onclick={onClose} aria-label="Close">&#x2715;</button>
    </div>

    <!-- Body -->
    <div class="dialog-body">

      {#if loading}
        <!-- Progress state -->
        <div class="loading-wrap">
          <div class="loading-box">
            <div class="loading-title">Loading {period}-Day History</div>
            <div class="loading-label">{loadLabel}</div>
            <div class="loading-track">
              <div class="loading-fill" style="width: {loadPct}%"></div>
            </div>
            <div class="loading-pct">{loadPct}%</div>
          </div>
        </div>

      {:else if error}
        <div class="error-msg">Error: {error}</div>

      {:else if data}

        {#if data.summary.total === 0}
          <div class="empty-state">
            <div class="empty-icon">◎</div>
            <div class="empty-title">No test results found</div>
            <div class="empty-sub">
              No manual test executions in the last {period} days
              {release ? `for ${release}` : ''}.
            </div>
          </div>

        {:else}

          <!-- Volume chart -->
          <div class="section">
            <div class="section-title">
              Test Volume — {data.summary.dateFrom} to {data.summary.dateTo}
            </div>
            <div class="chart">
              {#each data.byDate as day, i (day.date)}
                {@const chartMax = Math.max(1, ...data.byDate.map(d => d.passed + d.failed))}
                {@const total = day.passed + day.failed}
                {@const barH = chartMax > 0 ? Math.round((total / chartMax) * 100) : 0}
                <div
                  class="chart-col"
                  title="{shortDate(day.date)}: {day.passed + day.failed} tests ({day.passed} passed, {day.failed} failed)"
                >
                  <div class="chart-bar-area">
                    {#if total > 0}
                      <div class="chart-bar" style="height: {barH}%">
                        <div class="seg seg-failed" style="flex: {day.failed}"></div>
                        <div class="seg seg-passed" style="flex: {day.passed}"></div>
                      </div>
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

          <!-- Two-column tables -->
          <div class="tables-row">

            <!-- Top tested artifacts -->
            <div class="table-panel">
              <div class="table-title">Top Tested Artifacts</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Artifact</th>
                      <th class="num">Total</th>
                      <th class="num">Pass</th>
                      <th class="num">Fail</th>
                      <th class="num">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each data.byArtifact as row}
                      <tr>
                        <td>
                          <span class="art-name">{row.displayName}</span>
                          {#if row.arch}
                            <span class="art-arch">{row.arch}</span>
                          {/if}
                        </td>
                        <td class="num">{row.passed + row.failed}</td>
                        <td class="num green-text">{row.passed}</td>
                        <td class="num {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                        <td class="num">
                          {#if row.passRate !== null}
                            <span class="rate-badge {pctColorClass(row.passRate)}">{row.passRate}%</span>
                          {:else}
                            <span class="dim-text">-</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Top manual testers -->
            <div class="table-panel">
              <div class="table-title">Top Manual Testers</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tester</th>
                      <th class="num">Total</th>
                      <th class="num">Pass</th>
                      <th class="num">Fail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each data.byTester as row}
                      <tr>
                        <td class="tester-name">{row.tester || '(unknown)'}</td>
                        <td class="num">{row.total}</td>
                        <td class="num green-text">{row.passed}</td>
                        <td class="num {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        {/if}
      {/if}

    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ────────────────────────────────────────────── */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 299;
    background: rgba(0, 0, 0, 0.55);
  }

  /* ── Dialog ──────────────────────────────────────────────── */
  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 300;
    width: min(1000px, 94vw);
    max-height: 88vh;
    background: var(--bg-panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ──────────────────────────────────────────────── */
  .dialog-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1.25rem;
    height: 56px;
    border-bottom: 1px solid var(--border-mid);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .dialog-title {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    white-space: nowrap;
  }

  /* ── Period pills ────────────────────────────────────────── */
  .period-row {
    display: flex;
    gap: 0.25rem;
  }

  .period-pill {
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
  .period-pill:hover:not(:disabled) {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .period-pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 700;
  }
  .period-pill:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* ── Summary pills ───────────────────────────────────────── */
  .summary-pills {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    flex: 1;
  }

  .pill {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.55rem;
    border-radius: 10px;
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
    background: var(--bg-raised);
    font-variant-numeric: tabular-nums;
  }
  .pill.passed { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
  .pill.failed { color: var(--red);   border-color: var(--red-border);   background: var(--red-bg);   }
  .pill.rate.green { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
  .pill.rate.amber { color: var(--amber); border-color: var(--amber-border); background: var(--amber-bg); }
  .pill.rate.red   { color: var(--red);   border-color: var(--red-border);   background: var(--red-bg);   }

  .close-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    border-radius: 3px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover { color: var(--text); }

  /* ── Body ────────────────────────────────────────────────── */
  .dialog-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Loading ─────────────────────────────────────────────── */
  .loading-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 220px;
  }

  .loading-box {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 2rem 3rem;
    text-align: center;
    min-width: 340px;
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
    background: var(--bg-panel);
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
    font-size: 0.875rem;
    padding: 1rem 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    gap: 0.4rem;
    text-align: center;
  }
  .empty-icon  { font-size: 2rem; color: var(--border-strong); }
  .empty-title { font-size: 0.95rem; font-weight: 700; color: var(--text-muted); }
  .empty-sub   { font-size: 0.85rem; color: var(--text-dim); max-width: 380px; }

  /* ── Chart section ───────────────────────────────────────── */
  .section {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 0.9rem 1rem;
    flex-shrink: 0;
  }

  .section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  /* Bar chart */
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 110px;
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
    min-width: 12px;
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

  .seg { min-height: 1px; }
  .seg-passed { background: var(--green); }
  .seg-failed { background: var(--red); }

  .chart-date {
    position: absolute;
    bottom: -1.5rem;
    font-size: 0.58rem;
    color: var(--text-dim);
    white-space: nowrap;
    transform: translateX(-50%);
    left: 50%;
  }

  /* Show one label per week to avoid overlap */
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

  /* ── Tables row ──────────────────────────────────────────── */
  .tables-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    flex-shrink: 0;
  }

  .table-panel {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 0.85rem 1rem;
    overflow: hidden;
  }

  .table-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-dim);
    margin-bottom: 0.65rem;
  }

  .table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 260px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  thead tr { border-bottom: 1px solid var(--border-mid); }

  th {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-dim);
    padding: 0.25rem 0.5rem;
    text-align: left;
    position: sticky;
    top: 0;
    background: var(--bg-raised);
    white-space: nowrap;
  }

  td {
    padding: 0.3rem 0.5rem;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--surface-faint); }

  .num {
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
    margin-left: 0.3rem;
    font-size: 0.7rem;
    color: var(--text-dim);
    background: var(--bg-panel);
    padding: 0.05rem 0.3rem;
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
    padding: 0.08rem 0.38rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .rate-badge.green  { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
  .rate-badge.amber  { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
  .rate-badge.red    { background: var(--red-bg);   color: var(--red);   border: 1px solid var(--red-border);   }
  .rate-badge.neutral { color: var(--text-dim); }

  .green-text { color: var(--green); }
  .red-text   { color: var(--red);   }
  .dim-text   { color: var(--text-dim); }
</style>
