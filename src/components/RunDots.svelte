<script>
  /**
   * Strip of status dots for the recent runs of one test, oldest first.
   * The last dot is the result being shown.
   *
   * @type {{ runs: { status: string, version: string }[] }}
   */
  let { runs = [] } = $props()

  function tone(status) {
    if (status === 'PASSED') return 'pass'
    if (status === 'FAILED') return 'fail'
    return 'other'
  }

  function title(run) {
    return `${run.version ?? '—'} · ${run.status ?? '—'}`
  }

  let summary = $derived.by(() => {
    const passed = runs.filter(r => r.status === 'PASSED').length
    const failed = runs.filter(r => r.status === 'FAILED').length
    return `Last ${runs.length} run${runs.length !== 1 ? 's' : ''}: ` +
      `${passed} passed, ${failed} failed`
  })
</script>

<span class="run-dots" role="img" aria-label={summary}>
  {#each runs as run}
    <span class="dot {tone(run.status)}" title={title(run)}></span>
  {/each}
</span>

<style>
  .run-dots {
    align-items: center;
    display: inline-flex;
    gap: 0.25rem;
    vertical-align: middle;
  }

  .dot {
    border-radius: 50%;
    flex-shrink: 0;
    height: 0.5rem;
    width: 0.5rem;
  }


  .dot.pass  { background: var(--mc-positive); }
  .dot.fail  { background: var(--mc-negative); }
  .dot.other { background: var(--vf-color-text-muted); }
</style>
