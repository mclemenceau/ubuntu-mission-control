<script>
  /**
   * @typedef {{
   *   id: string|number,
   *   name: string,
   *   displayName: string,
   *   arch: string,
   *   type: string,
   *   version: string,
   *   bugs: string[]
   * }} Product
   * @type {{
   *   open?: boolean,
   *   products?: Product[],
   *   onClose?: () => void,
   *   onProductClick?: (product: Product) => void,
   * }}
   */
  let {
    open             = false,
    products         = [],
    onClose          = () => {},
    onProductClick   = () => {},
  } = $props()

  /**
   * Build a deduplicated list of { bugId, affectedProducts[] } sorted by
   * bug ID (ascending numeric). Each entry keeps the full product object
   * so the tag can render rich details and fire a click.
   */
  const bugEntries = $derived.by(() => {
    /** @type {Map<string, Product[]>} */
    const map = new Map()
    for (const p of products) {
      for (const bug of p.bugs ?? []) {
        if (!map.has(bug)) map.set(bug, [])
        // Deduplicate by product id in case the same product appears twice
        const list = map.get(bug)
        if (!list.some(x => x.id === p.id)) list.push(p)
      }
    }
    return [...map.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([bugId, affectedProducts]) => ({ bugId, affectedProducts }))
  })

  /** Build the human-readable label shown on each product tag. */
  function productLabel(p) {
    const parts = [p.displayName ?? p.name]
    if (p.arch)    parts.push(p.arch)
    if (p.type)    parts.push(p.type)
    if (p.version) parts.push(p.version)
    return parts.join(' - ')
  }

  function handleProductClick(p) {
    onClose()
    onProductClick(p)
  }
</script>

{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
{/if}

<aside class="panel" class:open aria-label="Open Bugs" aria-hidden={!open}>
  <div class="panel-header">
    <span class="panel-title">Open Bugs</span>
    <button class="close-btn" onclick={onClose} aria-label="Close bugs panel">
      &#x2715;
    </button>
  </div>

  <div class="panel-body">
    {#if bugEntries.length === 0}
      <div class="empty">No LP bugs referenced in test comments.</div>
    {:else}
      {#each bugEntries as { bugId, affectedProducts } (bugId)}
        <div class="bug-row">
          <div class="bug-ref">
            <a
              class="bug-link"
              href="https://launchpad.net/bugs/{bugId}"
              target="_blank"
              rel="noopener noreferrer"
            >LP #{bugId}</a>
          </div>
          <div class="bug-products">
            {#each affectedProducts as p (p.id)}
              <button
                class="product-tag"
                onclick={() => handleProductClick(p)}
                title="Open {productLabel(p)}"
              >{productLabel(p)}</button>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
    background: transparent;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    z-index: 200;
    background: var(--bg-panel);
    border-left: 1px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
  }

  .panel.open {
    transform: translateX(0);
  }

  /* ── Header ── */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
    height: 60px;
    border-bottom: 1px solid var(--border-mid);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    flex: 1;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    line-height: 1;
    border-radius: 3px;
    transition: color 0.15s;
    font-family: inherit;
  }
  .close-btn:hover { color: var(--text); }

  /* ── Body ── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0;
  }

  .empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    line-height: 1.6;
  }

  /* ── Bug row ── */
  .bug-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .bug-ref {
    display: flex;
    align-items: center;
  }

  .bug-link {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--accent);
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }
  .bug-link:hover { text-decoration: underline; }

  .bug-products {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* Clickable product tag - styled as a subtle button */
  .product-tag {
    display: block;
    width: 100%;
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-family: inherit;
    font-weight: 500;
    padding: 0.3em 0.6em;
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .product-tag:hover {
    background: var(--surface-hover);
    border-color: var(--accent);
    color: var(--text-bright);
  }
  .product-tag:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
