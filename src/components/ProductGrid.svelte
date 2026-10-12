<script>
  import ProductCard from './ProductCard.svelte'

  let { products, onSelectProduct } = $props()

  let gridEl = $state(null)

  function onGridKeydown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const cards = [...gridEl.querySelectorAll('button.chip')]
    const idx = cards.indexOf(document.activeElement)
    if (idx === -1) return
    e.preventDefault()
    const next = (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      ? cards[idx + 1]
      : cards[idx - 1]
    next?.focus()
  }

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
        const color = age === 999
          ? 'var(--vf-color-text-inactive)'
          : `hsl(${h},78%,42%)`
        // Sort stale items newest → oldest, then alphabetically by name
        if (age === 999) items.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
        // Sort non-stale items alphabetically by name
        else items.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
        return { label, age, items, color }
      })
  }

  let lanes = $derived(groupByAge(products))
</script>

{#if products.length === 0}
  <p class="u-text--muted empty">No artifacts found.</p>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="swimlanes" bind:this={gridEl} onkeydown={onGridKeydown} role="list">
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
            <ProductCard {product} onclick={() => onSelectProduct(product)} />
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
    gap: 0.5rem;
  }

  /* ── One lane = label rail + wrapping chips ─── */
  .lane {
    align-items: flex-start;
    display: flex;
  }

  /* Left rail */
  .rail {
    align-items: center;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.25rem;
    padding-top: 0.5rem;
    width: 5.5rem;
  }

  .rail-dot {
    background: var(--lane-color);
    border-radius: 50%;
    height: 0.5rem;
    width: 0.5rem;
  }

  .rail-label {
    color: var(--lane-color);
    font-size: 0.75rem;
    font-weight: 550;
    letter-spacing: 0.06em;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .rail-count {
    color: var(--vf-color-text-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    line-height: 1rem;
  }

  /* Chip area */
  .chips {
    border-left: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 5.25rem;
    padding: 0.25rem 0 0.25rem 0.75rem;
  }

  .empty {
    padding: 2rem;
  }
</style>
