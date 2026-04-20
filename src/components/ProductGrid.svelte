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
        const color = age === 999 ? '#3a3a3a' : `hsl(${h},78%,48%)`
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
  <div class="empty">No artifacts found.</div>
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
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Chip area */
  .chips {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-left: 1px solid var(--border);
    padding: 0.35rem 0 0.35rem 0.75rem;
    min-height: 84px;
  }

  .empty {
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem;
  }
</style>
