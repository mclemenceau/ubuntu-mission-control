<script>
  /** @type {{ product: import('../lib/processor.js').Product }} */
  let { product } = $props()

  const STATUS_LABELS = {
    APPROVED:         '✓ Approved',
    MARKED_AS_FAILED: '✗ Failed',
    UNDECIDED:        '? Undecided',
  }

  let badgeLabel = $derived(STATUS_LABELS[product.status] ?? '—')

  // Stale (not built today): only show green/red for reviewed artifacts,
  // everything else collapses to grey.
  let cardClass = $derived(
    product.status === 'APPROVED'           ? 'approved'
    : product.status === 'MARKED_AS_FAILED' ? 'failed'
    : product.builtToday                    ? 'pending'
    : 'stale'
  )

  let hasTests = $derived(
    product.tests.passed + product.tests.failed +
    product.tests.inProgress + product.tests.notStarted > 0
  )
</script>

<div class="card {cardClass}" class:mandatory={product.mandatory}>
  <div class="name" title={product.name}>{product.displayName}</div>
  <div class="meta">{product.type} · {product.arch}</div>

  <div class="row">
    <span class="badge {cardClass}">{badgeLabel}</span>
  </div>

  <div class="tests">
    {#if hasTests}
      {#if product.tests.passed > 0}
        <span class="chip pass">✓ {product.tests.passed}</span>
      {/if}
      {#if product.tests.failed > 0}
        <span class="chip fail">✗ {product.tests.failed}</span>
      {/if}
      {#if product.tests.inProgress > 0}
        <span class="chip prog">… {product.tests.inProgress}</span>
      {/if}
      {#if product.tests.notStarted > 0}
        <span class="chip skip">○ {product.tests.notStarted}</span>
      {/if}
    {:else}
      <span class="chip none">no tests</span>
    {/if}
  </div>

  <div class="version">{product.version}</div>
</div>

<style>
  .card {
    border: 1px solid var(--border-faint);
    border-radius: 5px;
    padding: 0.65rem 0.85rem;
    position: relative;
    background: var(--bg-panel);
    transition: border-color 0.3s, background 0.3s;
  }

  .card.approved { border-color: var(--green-border); background: var(--green-bg); }
  .card.failed   { border-color: var(--red-border);   background: var(--red-bg);   }
  .card.pending  { border-color: var(--amber-border); background: var(--amber-bg); }
  .card.stale    { border-color: #252525; background: #0c0c10; opacity: 0.6; }

  .card.mandatory::after {
    content: '★';
    position: absolute;
    top: 0.4rem;
    right: 0.55rem;
    color: var(--accent);
    font-size: 0.7rem;
  }

  .name {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #ddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 0.75rem;
  }

  .meta {
    font-size: 0.6875rem;
    color: var(--text-dim);
    margin-top: 0.1rem;
    margin-bottom: 0.4rem;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.25rem;
  }

  /* Status badge */
  .badge {
    display: inline-block;
    padding: 0.15em 0.5em;
    border-radius: 2px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: #222;
    color: var(--text-dim);
  }

  .badge.approved { background: var(--green-border); color: #5ddb5d; }
  .badge.failed   { background: var(--red-border);   color: var(--red); }
  .badge.pending  { background: #2a2a00; color: var(--amber); }
  .badge.stale    { background: transparent; color: #3a3a3a; }

  /* Test chips */
  .tests {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }

  .chip {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0.1em 0.35em;
    border-radius: 2px;
  }

  .chip.pass { background: #1a4d1a; color: #5ddb5d; }
  .chip.fail { background: #4d1a1a; color: var(--red); }
  .chip.prog { background: #1a2d4d; color: var(--blue); }
  .chip.skip { background: #2a2a2a; color: var(--text-muted); }
  .chip.none { color: #444; font-style: italic; font-size: 0.65rem; }

  .version {
    font-size: 0.6rem;
    font-family: monospace;
    color: #444;
    margin-top: 0.2rem;
  }
</style>
