<script>
  import ProductCard  from './ProductCard.svelte'
  import ProductModal from './ProductModal.svelte'

  /** @type {{ products: Array }} */
  let { products } = $props()

  let selectedProduct = $state(null)
</script>

{#if selectedProduct}
  <ProductModal product={selectedProduct} onclose={() => selectedProduct = null} />
{/if}

{#if products.length === 0}
  <div class="empty">No artifacts built today yet.</div>
{:else}
  <div class="grid">
    {#each products as product (product.id)}
      <ProductCard {product} onclick={() => selectedProduct = product} />
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }

  .empty {
    color: var(--text-dim);
    font-size: 0.9rem;
    padding: 2rem;
  }
</style>
