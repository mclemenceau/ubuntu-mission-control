<script>
  let { product, onclick } = $props()

  let cardClass = $derived(
    product.status === 'APPROVED'           ? 'approved'
    : product.status === 'MARKED_AS_FAILED' ? 'failed'
    : 'default'
  )

  let statusIcon = $derived(
    product.status === 'APPROVED'           ? '✓'
    : product.status === 'MARKED_AS_FAILED' ? '✗'
    : null
  )

  let hasTests = $derived(
    product.tests.passed + product.tests.failed +
    product.tests.inProgress + product.tests.notStarted > 0
  )
</script>

<button
  class="chip {cardClass}"
  {onclick}
  title="{product.name} · {product.version}"
>
  <div class="chip-top">
    <span class="chip-name">{product.displayName}</span>
    {#if statusIcon}
      <span class="chip-icon {cardClass}">{statusIcon}</span>
    {/if}
  </div>
  <div class="chip-bottom">
    <span class="chip-arch">{product.arch}</span>
    {#if hasTests}
      {#if product.tests.passed}    <span class="tc pass">✓{product.tests.passed}</span>{/if}
      {#if product.tests.failed}    <span class="tc fail">✗{product.tests.failed}</span>{/if}
      {#if product.tests.inProgress}<span class="tc prog">●{product.tests.inProgress}</span>{/if}
      {#if product.tests.notStarted}<span class="tc skip">○{product.tests.notStarted}</span>{/if}
    {/if}
  </div>
</button>

<style>
  .chip {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 224px;
    max-width: 336px;
    height: 74px;
    padding: 0.5rem 0.875rem 0.5rem 1rem;
    border-radius: 7px;
    border: 1px solid #252525;
    border-left: 4px solid #333;
    background: var(--bg-panel);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: filter 0.12s, transform 0.12s, box-shadow 0.12s;
  }

  .chip:hover {
    filter: brightness(1.25);
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  }

  .chip.approved {
    background: var(--green-bg);
    border-color: var(--green-border);
    border-left-color: var(--green);
  }
  .chip.failed {
    background: var(--red-bg);
    border-color: var(--red-border);
    border-left-color: var(--red);
  }
  .chip.default  { border-left-color: #3a3a3a; }

  /* ── Top row: name + status icon ─── */
  .chip-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.44rem;
    overflow: hidden;
  }

  .chip-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: #ddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .chip-icon {
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .chip-icon.approved { color: var(--green); }
  .chip-icon.failed   { color: var(--red);   }

  /* ── Bottom row: arch + test counts ─── */
  .chip-bottom {
    display: flex;
    align-items: center;
    gap: 0.38rem;
  }

  .chip-arch {
    font-size: 1rem;
    color: #555;
    flex-shrink: 0;
    margin-right: 0.18rem;
  }

  .tc {
    font-size: 0.98rem;
    font-weight: 700;
    padding: 0.05em 0.25em;
    border-radius: 3px;
    line-height: 1;
  }
  .tc.pass { color: #5ddb5d; }
  .tc.fail { color: var(--red); }
  .tc.prog { color: var(--blue); }
  .tc.skip { color: #555; }
</style>
