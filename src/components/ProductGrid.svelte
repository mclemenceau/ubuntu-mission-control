<script>
  import ProductCard  from './ProductCard.svelte'
  import ProductModal from './ProductModal.svelte'

  let { products } = $props()

  let selectedProduct = $state(null)

  // Group products into swimlanes by build age.
  // Ages 0–7 each get their own lane; anything older collapses into "Stale".
  function groupByAge(products) {
    const map = new Map()
    for (const p of products) {
      const age    = p.ageDays ?? 999
      const bucket = age > 7 ? 999 : age
      if (!map.has(bucket)) map.set(bucket, [])
      map.get(bucket).push(p)
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([age, items]) => {
        const label = age === 0   ? 'Today'
                    : age === 1   ? '1 day'
                    : age === 999 ? 'Stale'
                    : `${age} days`
        // Green (age=0) → orange-red (age=7) → grey (stale)
        const t     = Math.min(age === 999 ? 1 : age / 7, 1)
        const h     = Math.round(140 - t * 110)
        const color = age === 999 ? '#3a3a3a' : `hsl(${h},78%,48%)`
        return { label, age, items, color }
      })
  }

  let lanes = $derived(groupByAge(products))
</script>

{#if selectedProduct}
  <ProductModal product={selectedProduct} onclose={() => selectedProduct = null} />
{/if}

{#if products.length === 0}
  <div class="empty">No artifacts found.</div>
{:else}
  <div class="swimlanes">
    {#each lanes as lane}
      <div class="lane">

        <!-- Left rail: age label -->
        <div class="rail" style="--lane-color: {lane.color}">
          <span class="rail-dot"></span>
          <span class="rail-label">{lane.label}</span>
          <span class="rail-count">{lane.items.length}</span>
        </div>

        <!-- Chips -->
        <div class="chips">
          {#each lane.items as product (product.id)}
            <ProductCard {product} onclick={() => selectedProduct = product} />
          {/each}
        </div>

      </div>
    {/each}
  </div>
{/if}

<style>
  .swimlanes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  /* ── One lane = label rail + wrapping chips ─── */
  .lane {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  /* Left rail */
  .rail {
    flex-shrink: 0;
    width: 88px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 0.6rem;
    gap: 0.28rem;
  }

  .rail-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--lane-color);
  }

  .rail-label {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--lane-color);
    line-height: 1;
  }

  .rail-count {
    font-size: 0.68rem;
    color: #484848;
    font-variant-numeric: tabular-nums;
  }

  /* Chip area */
  .chips {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-left: 1px solid #1e1e1e;
    padding: 0.35rem 0 0.35rem 0.75rem;
    min-height: 84px;
  }

  .empty {
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem;
  }
</style>
