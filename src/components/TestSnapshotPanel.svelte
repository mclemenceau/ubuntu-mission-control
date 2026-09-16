<script>
  import { onMount } from 'svelte'
  import { buildCurrentTestSnapshot } from '../lib/processor.js'

  /**
   * @type {{
   *   open: boolean,
   *   products: any[],
   *   onClose: () => void,
   * }}
   */
  let { open = false, products = [], onClose = () => {} } = $props()

  // ── State ─────────────────────────────────────────────────────
  let loading  = $state(false)
  let error    = $state(null)
  let snapshot = $state(null)   // { summary, byArtifact, byTester, failures }

  // ── Load on open ──────────────────────────────────────────────
  $effect(() => {
    if (!open) return
    loadSnapshot()
  })

  async function loadSnapshot() {
    loading  = true
    error    = null
    snapshot = null
    try {
      snapshot = await buildCurrentTestSnapshot(products)
    } catch (err) {
      console.error('TestSnapshotPanel error:', err)
      error = err.message
    } finally {
      loading = false
    }
  }

  // ── Keyboard close ────────────────────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Escape') onClose()
  }

  // ── Helpers ───────────────────────────────────────────────────
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
  <div
    class="backdrop"
    onclick={onClose}
    role="presentation"
  ></div>

  <!-- Dialog -->
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Test Executions Overview">

    <!-- Header -->
    <div class="dialog-header">
      <div class="dialog-title">Test Executions — Current Snapshot</div>
      {#if snapshot}
        <div class="summary-pills">
          <span class="pill total">{snapshot.summary.total} tests</span>
          <span class="pill passed">{snapshot.summary.passed} passed</span>
          <span class="pill failed">{snapshot.summary.failed} failed</span>
          {#if snapshot.summary.passRate !== null}
            <span class="pill rate {pctColorClass(snapshot.summary.passRate)}">
              {snapshot.summary.passRate}% pass rate
            </span>
          {/if}
        </div>
      {/if}
      <button class="close-btn" onclick={onClose} aria-label="Close">&#x2715;</button>
    </div>

    <!-- Body -->
    <div class="dialog-body">

      {#if loading}
        <div class="loading-wrap">
          <div class="loading-spinner"></div>
          <div class="loading-label">Loading test results...</div>
        </div>

      {:else if error}
        <div class="error-msg">Error: {error}</div>

      {:else if snapshot}

        {#if snapshot.summary.total === 0}
          <div class="empty-state">
            <div class="empty-icon">◎</div>
            <div class="empty-title">No test results</div>
            <div class="empty-sub">No test results found for the current artifacts.</div>
          </div>

        {:else}

          <div class="panels-row">

            <!-- By Artifact -->
            <div class="panel">
              <div class="panel-title">By Artifact</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Artifact</th>
                      <th class="num">Pass</th>
                      <th class="num">Fail</th>
                      <th class="num">Rate</th>
                      <th class="num">Bugs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each snapshot.byArtifact as row (row.displayName + row.arch)}
                      <tr>
                        <td>
                          <span class="art-name">{row.displayName}</span>
                          {#if row.arch}
                            <span class="art-arch">{row.arch}</span>
                          {/if}
                        </td>
                        <td class="num green-text">{row.passed}</td>
                        <td class="num {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                        <td class="num">
                          {#if row.passRate !== null}
                            <span class="rate-badge {pctColorClass(row.passRate)}">{row.passRate}%</span>
                          {:else}
                            <span class="dim-text">-</span>
                          {/if}
                        </td>
                        <td class="num {row.bugs > 0 ? 'amber-text' : 'dim-text'}">{row.bugs}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- By Tester -->
            <div class="panel">
              <div class="panel-title">By Tester</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tester</th>
                      <th class="num">Pass</th>
                      <th class="num">Fail</th>
                      <th class="num">Rate</th>
                      <th class="num">Bugs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each snapshot.byTester as row (row.tester)}
                      <tr>
                        <td class="tester-name">{row.tester || '(unknown)'}</td>
                        <td class="num green-text">{row.passed}</td>
                        <td class="num {row.failed > 0 ? 'red-text' : 'dim-text'}">{row.failed}</td>
                        <td class="num">
                          {#if row.passRate !== null}
                            <span class="rate-badge {pctColorClass(row.passRate)}">{row.passRate}%</span>
                          {:else}
                            <span class="dim-text">-</span>
                          {/if}
                        </td>
                        <td class="num {row.bugs > 0 ? 'amber-text' : 'dim-text'}">{row.bugs}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- Failures section -->
          {#if snapshot.failures.length > 0}
            <div class="failures-section">
              <div class="panel-title">
                Failures
                <span class="failure-count">{snapshot.failures.length}</span>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Artifact</th>
                      <th>Test Case</th>
                      <th>Tester</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each snapshot.failures as f, i (i)}
                      <tr>
                        <td>
                          <span class="art-name">{f.displayName}</span>
                          {#if f.arch}
                            <span class="art-arch">{f.arch}</span>
                          {/if}
                        </td>
                        <td class="testcase-name">{f.testCase || '-'}</td>
                        <td class="tester-name">{f.tester || '(unknown)'}</td>
                        <td class="comment-cell">
                          {#if f.comment}
                            <span class="comment-text" title={f.comment}>
                              {f.comment.length > 80 ? f.comment.slice(0, 80) + '…' : f.comment}
                            </span>
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
          {/if}

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
    width: min(960px, 92vw);
    max-height: 82vh;
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 160px;
    gap: 0.75rem;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border-mid);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-label {
    font-size: 0.85rem;
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
    min-height: 160px;
    gap: 0.4rem;
    text-align: center;
  }
  .empty-icon { font-size: 2rem; color: var(--border-strong); }
  .empty-title { font-size: 0.95rem; font-weight: 700; color: var(--text-muted); }
  .empty-sub { font-size: 0.85rem; color: var(--text-dim); }

  /* ── Two-panel row ───────────────────────────────────────── */
  .panels-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .panel {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 0.85rem 1rem;
    overflow: hidden;
  }

  .panel-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-dim);
    margin-bottom: 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Failures section ────────────────────────────────────── */
  .failures-section {
    background: var(--bg-raised);
    border: 1px solid var(--red-border, #5a2020);
    border-radius: 6px;
    padding: 0.85rem 1rem;
    overflow: hidden;
  }

  .failures-section .panel-title {
    color: var(--red);
  }

  .failure-count {
    background: var(--red-bg);
    border: 1px solid var(--red-border);
    color: var(--red);
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.05rem 0.4rem;
    border-radius: 8px;
  }

  /* ── Tables ──────────────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 260px;
  }

  .failures-section .table-wrap {
    max-height: 220px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  thead tr {
    border-bottom: 1px solid var(--border-mid);
  }

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
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .testcase-name {
    color: var(--text-muted);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .comment-cell { max-width: 260px; }
  .comment-text {
    font-size: 0.78rem;
    color: var(--text-dim);
    font-style: italic;
    cursor: help;
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
  .amber-text { color: var(--amber); }
  .red-text   { color: var(--red);   }
  .dim-text   { color: var(--text-dim); }
</style>
