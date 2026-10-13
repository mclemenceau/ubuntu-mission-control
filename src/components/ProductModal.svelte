<script>
  import { onMount } from 'svelte'
  import cofOrange from '../assets/cof-orange.png'
  import { fetchBuilds } from '../api/client.js'
  import HistoryPanel from './HistoryPanel.svelte'

  /** @type {{ product: import('../lib/processor.js').Product, onclose: () => void }} */
  let { product, onclose } = $props()

  let builds  = $state([])
  let loading = $state(true)
  let error   = $state(null)

  let showHistory    = $state(false)
  let viewedArtefact = $state(null)

  const FLAVOR_ICONS = {
    edubuntu:         'https://assets.ubuntu.com/v1/a2f090ef-edubuntu-logo.svg',
    kubuntu:          'https://assets.ubuntu.com/v1/d92401b4-kubuntu-logo.svg',
    lubuntu:          'https://assets.ubuntu.com/v1/6ac4ba34-lubuntu-logo.svg',
    'ubuntu-budgie':  'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    budgie:           'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    'ubuntu-cinnamon':'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    cinnamon:         'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    'ubuntu-kylin':   'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    kylin:            'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    'ubuntu-mate':    'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    mate:             'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    'ubuntu-studio':  'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    studio:           'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    'ubuntu-unity':   'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    unity:            'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    xubuntu:          'https://assets.ubuntu.com/v1/36e8f12b-Xubuntu_logo.svg',
  }

  let flavorIcon = $derived.by(() => {
    const n = ((product.name ?? '') + ' ' + (product.displayName ?? '')).toLowerCase()
    for (const [key, url] of Object.entries(FLAVOR_ICONS)) {
      if (n.includes(key)) return url
    }
    return cofOrange
  })

  const STATUS_LABELS = {
    APPROVED:         'Approved',
    MARKED_AS_FAILED: 'Failed',
    UNDECIDED:        'Undecided',
  }

  // Only APPROVED and MARKED_AS_FAILED get a tone; everything else is neutral.
  let tone = $derived(
    product.status === 'APPROVED'           ? 'positive'
    : product.status === 'MARKED_AS_FAILED' ? 'negative'
    : 'neutral'
  )

  onMount(async () => {
    try {
      builds = await fetchBuilds(product.id)
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onclose()
  }

  function onKeydown(e) {
    if (e.key === 'Escape') onclose()
  }

  /** Return the image folder URL from the first ci_link found in any test execution. */
  function getBuildFolderLink(build) {
    for (const te of build.test_executions ?? []) {
      if (te.ci_link) {
        const lastSlash = te.ci_link.lastIndexOf('/')
        return lastSlash > 0 ? te.ci_link.slice(0, lastSlash + 1) : null
      }
    }
    return null
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="p-modal" onclick={onBackdropClick} role="presentation">
  <section
    class="p-modal__dialog product-modal tone-{tone}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="product-modal-title"
  >

    <!-- ── Header ─────────────────────────────────────────────── -->
    <header class="p-modal__header">
      <div class="header-left">
        <img class="header-flavor-icon" src={flavorIcon} alt="" aria-hidden="true" />
        <div class="header-left-text">
          <h2 class="p-modal__title modal-name" id="product-modal-title">
            {#if product.displayName}
              <span class="os-tag">{product.displayName}</span>
            {/if}
            <span class="u-truncate" title={product.name}>{product.name}</span>
            <a href="https://tests.ubuntu.com/#/images/{product.id}"
               target="_blank"
               rel="noopener noreferrer"
               title="Open on tests.ubuntu.com"
            ><i class="p-icon--external-link">Open on tests.ubuntu.com</i></a>
          </h2>
          <div class="modal-sub u-text--muted">
            {product.type}{product.arch ? ` · ${product.arch}` : ''}
            {#if product.mandatory}
              <span class="p-chip is-dense is-readonly">
                <span class="p-chip__value">★ Mandatory</span>
              </span>
            {/if}
          </div>
        </div>
      </div>
      <div class="header-right">
        {#if tone === 'neutral'}
          <span class="p-status-label">{STATUS_LABELS[product.status] ?? '—'}</span>
        {:else}
          <span class="p-status-label--{tone}">{STATUS_LABELS[product.status]}</span>
        {/if}
        {#if product.ageDays !== null}
          <span class="u-text--muted">
            {product.ageDays === 0 ? 'built today' : `${product.ageDays}d old`}
          </span>
        {/if}
      </div>
      <button class="p-modal__close" onclick={onclose} aria-label="Close">Close</button>
    </header>

    <!-- ── View toggle ───────────────────────────────────────────── -->
    <div class="p-segmented-control is-dense view-nav">
      <div class="p-segmented-control__list" role="tablist" aria-label="View">
        <button
          class="p-segmented-control__button"
          role="tab"
          aria-selected={!showHistory}
          onclick={() => showHistory = false}
        >Latest build</button>
        <button
          class="p-segmented-control__button"
          role="tab"
          aria-selected={showHistory}
          onclick={() => showHistory = true}
        >30-day history</button>
      </div>
    </div>

    <!-- ── Artifact details strip ─────────────────────────────── -->
    <dl class="details-strip">
      <div class="detail-item">
        <dt class="mc-label">Release</dt>
        <dd>{product.release || '—'}</dd>
      </div>
      <div class="detail-item">
        <dt class="mc-label">Version</dt>
        <dd class="mono">{showHistory
          ? (viewedArtefact?.version ?? product.version ?? '—')
          : (product.version ?? '—')}</dd>
      </div>
      <div class="detail-item">
        <dt class="mc-label">Architecture</dt>
        <dd>{product.arch || '—'}</dd>
      </div>
      <div class="detail-item">
        <dt class="mc-label">Type</dt>
        <dd>{product.type || '—'}</dd>
      </div>
      {#if product.bugs.length > 0}
        <div class="detail-item full">
          <dt class="mc-label">Bugs</dt>
          <dd>
            {#each product.bugs as bug}
              <a class="mono" href="https://launchpad.net/bugs/{bug}">LP#{bug}</a>
            {/each}
          </dd>
        </div>
      {/if}
    </dl>

    <!-- ── Latest builds (minimal one-liner per build) ──────────── -->
    {#if !showHistory && !loading && !error && builds.length > 0}
      <div class="builds-strip">
        <span class="mc-label">Latest</span>
        {#each builds as build, bi}
          {@const folderLink = getBuildFolderLink(build)}
          <div class="build-line">
            {#if builds.length > 1}<strong>#{bi + 1}</strong>{/if}
            {#if build.architecture}<span class="mono">{build.architecture}</span>{/if}
            {#if build.revision}
              <span class="mono u-text--muted">{build.revision}</span>
            {/if}
            {#if folderLink}
              <a href={folderLink} target="_blank" rel="noopener noreferrer">Source ↗</a>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- ── Test detail + 30-day history ──────────────────────────── -->
    <HistoryPanel
      {product}
      showCalendar={showHistory}
      onArtefactChange={(a) => viewedArtefact = a}
    />

  </section>
</div>

<style>
  .product-modal {
    border-top: 4px solid var(--vf-color-border-high-contrast);
    max-height: 88vh;
    max-width: 77rem;
    width: 100%;
  }
  .product-modal.tone-positive { border-top-color: var(--mc-positive); }
  .product-modal.tone-negative { border-top-color: var(--mc-negative); }

  /* ── Header ───────────────────────────────────────────────── */
  .p-modal__header {
    align-items: center;
    gap: 1.5rem;
    padding-bottom: 1rem;
  }

  .header-left {
    align-items: center;
    display: flex;
    gap: 1rem;
    min-width: 0;
  }

  .header-flavor-icon {
    flex-shrink: 0;
    height: 2.5rem;
    object-fit: contain;
    width: 2.5rem;
  }

  .header-left-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .modal-name {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    white-space: nowrap;
  }

  .os-tag {
    color: var(--mc-brand);
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .modal-sub {
    align-items: center;
    display: flex;
    gap: 0.75rem;
  }

  .modal-sub .p-chip {
    margin: 0;
  }

  .header-right {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 1rem;
    white-space: nowrap;
  }

  /* ── View toggle ──────────────────────────────────────────── */
  .view-nav {
    margin-bottom: 0.75rem;
  }

  .view-nav button {
    margin-bottom: 0;
  }

  /* ── Details strip ────────────────────────────────────────── */
  .details-strip {
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2rem;
    margin: 0;
    padding-bottom: 0.75rem;
  }

  .detail-item {
    align-items: baseline;
    display: flex;
    gap: 0.5rem;
  }
  .detail-item.full { flex-basis: 100%; }

  .detail-item dt,
  .detail-item dd {
    margin: 0;
    padding: 0;
  }

  .detail-item dd {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* ── Latest builds strip ──────────────────────────────────── */
  .builds-strip {
    align-items: center;
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0;
  }

  .build-line {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }

  .mono { font-family: var(--mc-font-mono); }
</style>
