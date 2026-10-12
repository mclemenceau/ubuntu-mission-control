<script>
  import SidePanel from './SidePanel.svelte'

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

<SidePanel {open} title="Open bugs" width="25rem" {onClose}>
  {#if bugEntries.length === 0}
    <p class="u-text--muted empty">No LP bugs referenced in test comments.</p>
  {:else}
    {#each bugEntries as { bugId, affectedProducts } (bugId)}
      <div class="bug-row">
        <a
          class="bug-link"
          href="https://launchpad.net/bugs/{bugId}"
          target="_blank"
          rel="noopener noreferrer"
        >LP #{bugId}</a>
        <div class="bug-products">
          {#each affectedProducts as p (p.id)}
            <button
              class="p-chip is-dense product-tag"
              onclick={() => handleProductClick(p)}
              title="Open {productLabel(p)}"
            ><span class="p-chip__value">{productLabel(p)}</span></button>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</SidePanel>

<style>
  .empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  /* ── Bug row ── */
  .bug-row {
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }

  .bug-link {
    align-self: flex-start;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
  }

  .bug-products {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .product-tag {
    justify-content: flex-start;
    margin: 0;
    max-width: 100%;
  }

  .product-tag .p-chip__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
