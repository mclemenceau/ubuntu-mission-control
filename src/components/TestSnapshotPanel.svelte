<script>
  import { buildCurrentTestSnapshot } from '../lib/processor.js'
  import { pctColor } from '../lib/utils.js'

  /**
   * @type {{
   *   open: boolean,
   *   products: any[],
   *   onClose: () => void,
   * }}
   */
  let { open = false, products = [], onClose = () => {} } = $props()

  // ── State ─────────────────────────────────────────────────────
  let loading    = $state(false)
  let error      = $state(null)
  let snapshot   = $state(null)   // { summary, byArtifact, byTester, failures }
  let testerMode = $state('all')  // 'all' | 'manual' | 'automated'

  // Filter tester rows client-side based on mode
  let byTesterFiltered = $derived.by(() => {
    if (!snapshot) return []
    if (testerMode === 'manual')
      return snapshot.byTester.filter(r => r.manualTotal > 0)
    if (testerMode === 'automated')
      return snapshot.byTester.filter(r => r.automatedTotal > 0)
    return snapshot.byTester
  })

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

  const TESTER_MODES = [
    { id: 'all',       label: 'All'       },
    { id: 'manual',    label: 'Manual'    },
    { id: 'automated', label: 'Automated' },
  ]

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="p-modal" onclick={onBackdropClick} role="presentation">
    <section
      class="p-modal__dialog snapshot"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-title"
    >
      <header class="p-modal__header">
        <h2 class="p-modal__title" id="snapshot-title">
          Test executions — current snapshot
        </h2>
        <button class="p-modal__close" onclick={onClose} aria-label="Close">Close</button>
      </header>

      {#if snapshot}
        <div class="summary">
          <span class="p-chip is-dense is-readonly">
            <span class="p-chip__value">{snapshot.summary.total} tests</span>
          </span>
          <span class="p-chip--positive is-dense is-readonly">
            <span class="p-chip__value">{snapshot.summary.passed} passed</span>
          </span>
          <span class="p-chip--negative is-dense is-readonly">
            <span class="p-chip__value">{snapshot.summary.failed} failed</span>
          </span>
          {#if snapshot.summary.passRate !== null}
            <span class="p-chip--{pctColor(snapshot.summary.passRate)} is-dense is-readonly">
              <span class="p-chip__value">
                {snapshot.summary.passRate}% pass rate
              </span>
            </span>
          {/if}
        </div>
      {/if}

      <div class="body">
        {#if loading}
          <div class="loading-wrap">
            <i class="p-icon--spinner u-animation--spin"></i>
            <span class="u-text--muted">Loading test results...</span>
          </div>

        {:else if error}
          <div class="p-notification--negative">
            <div class="p-notification__content">
              <h5 class="p-notification__title">Error</h5>
              <p class="p-notification__message">{error}</p>
            </div>
          </div>

        {:else if snapshot}

          {#if snapshot.summary.total === 0}
            <div class="empty-state">
              <h3 class="p-heading--5">No test results</h3>
              <p class="u-text--muted">
                No test results found for the current artifacts.
              </p>
            </div>

          {:else}

            <div class="panels-row">

              <!-- By Artifact -->
              <section class="mc-surface">
                <h3 class="mc-label panel-title">By artifact</h3>
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
                      {#each snapshot.byArtifact as row (row.displayName + row.arch)}
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
                              <span class="u-text--muted">-</span>
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

              <!-- By Tester -->
              <section class="mc-surface">
                <div class="panel-title-row">
                  <h3 class="mc-label">By tester</h3>
                  <div class="p-segmented-control is-dense">
                    <div class="p-segmented-control__list" role="tablist"
                         aria-label="Test type">
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
                      {#each byTesterFiltered as row (row.tester)}
                        <tr>
                          <td class="u-truncate tester-name">
                            {row.tester || '(unknown)'}
                          </td>
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
                              <span class="u-text--muted">-</span>
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

            <!-- Failures section -->
            {#if snapshot.failures.length > 0}
              <section class="mc-surface failures">
                <h3 class="mc-label panel-title">
                  Failures
                  <span class="p-badge--negative">{snapshot.failures.length}</span>
                </h3>
                <div class="table-wrap failures-wrap">
                  <table class="mc-table">
                    <thead>
                      <tr>
                        <th>Artifact</th>
                        <th>Test case</th>
                        <th>Tester</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each snapshot.failures as f, i (i)}
                        <tr>
                          <td>
                            <strong>{f.displayName}</strong>
                            {#if f.arch}
                              <span class="u-text--muted art-arch">{f.arch}</span>
                            {/if}
                          </td>
                          <td class="u-truncate testcase-name">{f.testCase || '-'}</td>
                          <td class="u-truncate tester-name">{f.tester || '(unknown)'}</td>
                          <td class="comment-cell">
                            {#if f.comment}
                              <span class="u-text--muted comment-text" title={f.comment}>
                                {f.comment.length > 80
                                  ? f.comment.slice(0, 80) + '…' : f.comment}
                              </span>
                            {:else}
                              <span class="u-text--muted">-</span>
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </section>
            {/if}

          {/if}
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .snapshot {
    max-height: 82vh;
    max-width: 60rem;
    width: 100%;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .summary [class*='p-chip'] {
    margin: 0;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 0.5rem;
  }

  /* ── Loading / empty ─────────────────────────────────────── */
  .loading-wrap {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    justify-content: center;
    min-height: 10rem;
  }

  .empty-state {
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 10rem;
    text-align: center;
  }

  /* ── Two-panel row ───────────────────────────────────────── */
  .panels-row {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 1fr;
  }

  .panels-row > section {
    min-width: 0;
  }

  .panel-title {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .panel-title-row {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .panel-title-row .p-segmented-control__button {
    margin-bottom: 0;
  }

  /* ── Failures section ────────────────────────────────────── */
  .failures {
    border-color: var(--vf-color-border-negative);
  }

  .failures .panel-title {
    color: var(--mc-negative);
  }

  /* ── Tables ──────────────────────────────────────────────── */
  .table-wrap {
    max-height: 16rem;
    overflow: auto;
  }

  .failures-wrap {
    max-height: 14rem;
  }

  .art-arch {
    font-size: 0.875rem;
    margin-left: 0.375rem;
  }

  .tester-name {
    max-width: 11rem;
  }

  .testcase-name {
    max-width: 14rem;
  }

  .comment-cell {
    max-width: 16rem;
  }

  .comment-text {
    cursor: help;
    font-size: 0.875rem;
    font-style: italic;
  }
</style>
