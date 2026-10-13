<script>
  /**
   * Strip of status dots for the recent runs of one test, oldest first.
   * Ringed dots are re-runs on the same artifact; the last, larger dot is
   * the result being shown.
   *
   * @type {{ runs: { status: string, version: string, rerun: boolean,
   *                  current: boolean }[] }}
   */
  let { runs = [] } = $props()

  function tone(status) {
    if (status === 'PASSED') return 'pass'
    if (status === 'FAILED') return 'fail'
    return 'other'
  }

  function title(run) {
    const suffix = run.current ? ' (current)' : run.rerun ? ' (rerun)' : ''
    return `${run.version ?? '—'} · ${run.status ?? '—'}${suffix}`
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
    <span
      class="dot {tone(run.status)}"
      class:rerun={run.rerun}
      class:current={run.current}
      title={title(run)}
    ></span>
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

  .dot.current {
    height: 0.75rem;
    width: 0.75rem;
  }

  .dot.pass  { background: var(--mc-positive); }
  .dot.fail  { background: var(--mc-negative); }
  .dot.other { background: var(--vf-color-text-muted); }

  .dot.rerun {
    box-shadow: 0 0 0 1.5px var(--vf-color-background-default, #fff),
                0 0 0 3px currentColor;
    margin: 0 3px;
  }
</style>
