<script>
  /** @type {{ product: import('../lib/processor.js').Product, onclick: () => void, variant?: string }} */
  let { product, onclick, variant = 'default' } = $props()

  const STATUS_LABELS = {
    APPROVED:         '✓ Approved',
    MARKED_AS_FAILED: '✗ Failed',
    UNDECIDED:        '? Undecided',
  }

  let badgeLabel = $derived(STATUS_LABELS[product.status] ?? '—')

  // Approved/Failed override everything. Otherwise colour by age:
  // 0–7 days = blue gradient (bright → dark), >7 days = grey.
  let cardClass = $derived(
    product.status === 'APPROVED'           ? 'approved'
    : product.status === 'MARKED_AS_FAILED' ? 'failed'
    : (product.ageDays ?? 99) > 7          ? 'stale'
    : 'age'
  )

  // Always compute age CSS vars — used by both the card colouring and the
  // bottom strip/pill, including on approved/failed cards.
  // Hue sweeps green(140) → orange-red(30) as builds age, giving a wide
  // traffic-light range rather than a subtle single-hue gradient.
  function ageVars(ageDays) {
    if (ageDays === null || ageDays > 7) {
      return '--age-border:#2a2a2a; --age-bg:#0c0c10; --age-badge:transparent; --age-text:#555'
    }
    const t = ageDays / 7        // 0 = fresh, 1 = oldest-before-stale
    const h = Math.round(140 - t * 110)   // green(140) → orange-red(30)
    const borderL  = Math.round(60 - t * 20)   // 60% → 40%
    const bgL      = Math.round(18 - t * 10)   // 18% → 8%
    const badgeBgL = Math.round(22 - t * 12)   // 22% → 10%
    const textL    = Math.round(78 - t * 18)   // 78% → 60%
    return [
      `--age-border: hsl(${h},85%,${borderL}%)`,
      `--age-bg:     hsl(${h},70%,${bgL}%)`,
      `--age-badge:  hsl(${h},60%,${badgeBgL}%)`,
      `--age-text:   hsl(${h},85%,${textL}%)`,
    ].join('; ')
  }

  let cardStyle = $derived(ageVars(product.ageDays))

  let ageLabel = $derived(
    product.ageDays === null  ? null
    : product.ageDays === 0   ? 'today'
    : `${product.ageDays}d`
  )

  let hasTests = $derived(
    product.tests.passed + product.tests.failed +
    product.tests.inProgress + product.tests.notStarted > 0
  )
</script>

<div class="card {cardClass} v-{variant}" class:mandatory={product.mandatory} style={cardStyle} {onclick} role="button" tabindex="0">
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
  {#if ageLabel !== null}
    <span class="age-label">{ageLabel}</span>
  {/if}
</div>

<style>
  .card {
    border: 1px solid var(--border-faint);
    border-radius: 5px;
    padding: 0.65rem 0.85rem;
    padding-bottom: 0.85rem;
    position: relative;
    background: var(--bg-panel);
    overflow: hidden;
    transition: border-color 0.3s, background 0.3s, transform 0.15s, box-shadow 0.15s;
    cursor: default;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    filter: brightness(1.12);
  }

  /* Bottom accent strip — age colour on all cards */
  .card::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--age-border);
    opacity: 0.9;
  }

  .card.approved { border-color: var(--green-border); background: var(--green-bg); }
  .card.failed   { border-color: var(--red-border);   background: var(--red-bg);   }
  .card.age      { border-color: var(--age-border);   background: var(--age-bg);   }
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
  .badge.age      { background: var(--age-badge);    color: var(--age-text); }
  .badge.stale    { background: transparent; color: #666; }

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
  .chip.none { color: #666; font-style: italic; font-size: 0.65rem; }

  .version {
    font-size: 0.6rem;
    font-family: monospace;
    color: #666;
    margin-top: 0.2rem;
  }

  /* Age pill — bottom-right corner */
  .age-label {
    position: absolute;
    bottom: 0.35rem;
    right: 0.55rem;
    font-size: 0.6rem;
    font-family: monospace;
    font-weight: 700;
    color: var(--age-text);
    letter-spacing: 0.03em;
  }

  /* ── Variant A: bold left inset stripe, uniform dark cards ───── */
  .card.v-A.age   { border-color: var(--border-faint); background: var(--bg-panel); box-shadow: inset 5px 0 0 var(--age-border); }
  .card.v-A.stale { border-color: #252525; background: #0c0c10; box-shadow: inset 5px 0 0 #2a2a2a; }
  .card.v-A::before { opacity: 0; }
  .v-A .badge.age   { background: #1e1e1e; color: #777; }
  .v-A .age-label   { color: var(--age-text); }

  /* ── Variant B: top glow bar, dark cards ─────────────────────── */
  .card.v-B.age   { border-color: var(--border-faint); border-top-color: var(--age-border); border-top-width: 3px; background: var(--bg-panel); }
  .card.v-B.stale { border-color: #252525; background: #0c0c10; }
  .card.v-B::before { top: 0; bottom: auto; height: 4px; opacity: 1; }
  .v-B .badge.age   { background: #1e1e1e; color: #777; }
  .v-B .age-label   { color: var(--age-text); }

  /* ── Variant C: uniform dark cards, age shown only via filled pill */
  .card.v-C.age   { border-color: var(--border-faint); background: var(--bg-panel); }
  .card.v-C.stale { border-color: #252525; background: #0c0c10; opacity: 0.6; }
  .card.v-C::before { opacity: 0; }
  .v-C .badge.age   { background: #1e1e1e; color: #777; }
  .v-C .age-label   {
    background: var(--age-badge);
    color: var(--age-text);
    padding: 0.15em 0.45em;
    border-radius: 3px;
    bottom: 0.4rem;
  }
</style>
