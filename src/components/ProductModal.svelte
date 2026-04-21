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
    APPROVED:         '✓ Approved',
    MARKED_AS_FAILED: '✗ Failed',
    UNDECIDED:        '? Undecided',
  }

  // Only APPROVED and MARKED_AS_FAILED colour the header; everything else is neutral.
  let cardClass = $derived(
    product.status === 'APPROVED'           ? 'approved'
    : product.status === 'MARKED_AS_FAILED' ? 'failed'
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
<div class="backdrop" onclick={onBackdropClick} role="presentation">
  <div class="modal" role="dialog" aria-modal="true">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="modal-header {cardClass}">
      <div class="header-left">
        <img class="header-flavor-icon" src={flavorIcon} alt="" aria-hidden="true" />
        <div class="header-left-text">
          <div class="modal-name">
            {#if product.displayName}<span class="os-tag">{product.displayName}</span>{/if}
            <span title={product.name}>{product.name}</span>
            <a class="ext-link"
               href="https://tests.ubuntu.com/#/images/{product.id}"
               target="_blank"
               rel="noopener noreferrer"
               title="Open on tests.ubuntu.com">↗</a>
          </div>
          <div class="modal-sub">
            {product.type}{product.arch ? ` · ${product.arch}` : ''}
            {#if product.mandatory}<span class="mandatory-tag">★ mandatory</span>{/if}
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="hbadge {cardClass}">{STATUS_LABELS[product.status] ?? '—'}</span>
        {#if product.ageDays !== null}
          <span class="age-chip">
            {product.ageDays === 0 ? 'built today' : `${product.ageDays}d old`}
          </span>
        {/if}
        <button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
      </div>
    </div>

    <!-- ── View toggle nav ───────────────────────────────────────── -->
    <div class="view-nav">
      <button class="vnav-btn" class:active={!showHistory} onclick={() => showHistory = false}>
        Latest Build
      </button>
      <span class="vnav-sep">|</span>
      <button class="vnav-btn" class:active={showHistory} onclick={() => showHistory = true}>
        Show 30 Days History
      </button>
    </div>

    <!-- ── Artifact details strip ─────────────────────────────── -->
    <div class="details-strip">
      <div class="detail-item">
        <span class="dl">Release</span>
        <span class="dv">{product.release || '—'}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Version</span>
        <span class="dv mono">{showHistory ? (viewedArtefact?.version ?? product.version ?? '—') : (product.version ?? '—')}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Architecture</span>
        <span class="dv">{product.arch || '—'}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Type</span>
        <span class="dv">{product.type || '—'}</span>
      </div>
      {#if product.bugs.length > 0}
        <div class="detail-item full">
          <span class="dl">Bugs</span>
          <span class="dv">
            {#each product.bugs as bug}
              <a href="https://launchpad.net/bugs/{bug}">
                <span class="bug-tag">LP#{bug}</span>
              </a>
            {/each}
          </span>
        </div>
      {/if}
    </div>

    <!-- ── Latest builds (minimal one-liner per build) ──────────── -->
    {#if !showHistory && !loading && !error && builds.length > 0}
      <div class="builds-strip">
        <span class="builds-label">Latest</span>
        {#each builds as build, bi}
          {@const folderLink = getBuildFolderLink(build)}
          <div class="build-line">
            {#if builds.length > 1}<span class="build-num">#{bi + 1}</span>{/if}
            {#if build.architecture}<span class="build-arch">{build.architecture}</span>{/if}
            {#if build.revision}<span class="build-rev">{build.revision}</span>{/if}
            {#if folderLink}
              <a class="build-link" href={folderLink} target="_blank" rel="noopener noreferrer">↗ source</a>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- ── Test detail + 30-day history ──────────────────────────── -->
    <div class="history-wrap">
      <HistoryPanel {product} showCalendar={showHistory} onArtefactChange={(a) => viewedArtefact = a} />
    </div>

  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal {
    width: 100%;
    max-width: 1232px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    border-radius: 11px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-panel);
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  }

  /* ── Header ───────────────────────────────────────────────── */
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.54rem;
    padding: 1.32rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .modal-header.approved { background: var(--green-bg);  border-bottom-color: var(--green-border); }
  .modal-header.failed   { background: var(--red-bg);    border-bottom-color: var(--red-border); }
  .modal-header.neutral  { background: var(--bg-base);   border-bottom-color: var(--border-subtle); }

  .header-left  { display: flex; flex-direction: row; align-items: center; gap: 0.88rem; min-width: 0; }

  .header-flavor-icon {
    width: 42px;
    height: 42px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .header-left-text { display: flex; flex-direction: column; gap: 0.31rem; min-width: 0; }
  .header-right { display: flex; align-items: center; gap: 0.77rem; flex-shrink: 0; }

  .modal-name {
    font-size: 1.41rem;
    font-weight: 700;
    color: var(--text-bright);
    display: flex;
    align-items: center;
    gap: 0.62rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .ext-link {
    font-size: 1.06rem;
    font-weight: 400;
    color: var(--accent);
    text-decoration: none;
    opacity: 0.7;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }
  .ext-link:hover { opacity: 1; }

  .os-tag {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
    background: rgba(255,255,255,0.07);
    padding: 0.15em 0.5em;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .modal-sub {
    font-size: 1.06rem;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 0.62rem;
  }

  .mandatory-tag {
    color: var(--accent);
    font-size: 1rem;
    font-weight: 700;
  }

  .hbadge {
    display: inline-block;
    padding: 0.15em 0.55em;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--bg-raised);
    color: var(--text-dim);
  }
  .hbadge.approved { background: var(--green-border); color: #5ddb5d; }
  .hbadge.failed   { background: var(--red-border);   color: var(--red); }
  .hbadge.neutral  { background: transparent;         color: var(--text-muted); }

  .age-chip {
    font-size: 1rem;
    font-family: monospace;
    font-weight: 700;
    color: var(--text-muted);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 1.32rem;
    cursor: pointer;
    padding: 0.22rem 0.44rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .close-btn:hover { color: var(--text-bright); background: var(--surface-hover); }

  /* ── View toggle nav ──────────────────────────────────────── */
  .view-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: var(--bg-base);
    flex-shrink: 0;
  }

  .vnav-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0.25em 0.55em;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .vnav-btn:hover { color: var(--text-normal); background: var(--surface-hover); }
  .vnav-btn.active { color: var(--accent); background: rgba(255,255,255,0.05); }

  .vnav-sep {
    color: var(--border-mid);
    font-size: 0.9rem;
    user-select: none;
  }

  /* ── Details strip ────────────────────────────────────────── */
  .details-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.77rem 2.2rem;
    padding: 0.77rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
  }

  .detail-item {
    display: flex;
    align-items: baseline;
    gap: 0.53rem;
  }
  .detail-item.full { flex-basis: 100%; }

  .dl {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .dv {
    font-size: 1rem;
    color: var(--text-normal);
    display: flex;
    align-items: center;
    gap: 0.39rem;
    flex-wrap: wrap;
  }

  /* ── Latest builds strip ──────────────────────────────────── */
  .builds-strip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
    padding: 0.55rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
    background: var(--surface-faint);
  }

  .builds-label {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-right: 0.3rem;
  }

  .build-line {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.97rem;
    color: var(--text-muted);
  }

  .build-num  { font-weight: 700; color: var(--text-dim); }
  .build-arch { font-family: monospace; color: var(--text-soft); }
  .build-rev  { font-family: monospace; font-size: 0.88rem; color: var(--text-dim); }

  .build-link {
    font-size: 0.9rem;
    color: var(--accent);
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 0.15s;
  }
  .build-link:hover { opacity: 1; }

  /* ── History wrap (fills remaining space, scrollable) ─────── */
  .history-wrap {
    overflow-y: auto;
    flex: 1;
  }

  /* ── Shared tags ──────────────────────────────────────────── */
  .bug-tag {
    background: #2d1a00;
    color: #cc7700;
    border: 1px solid #5a3500;
    padding: 0.1em 0.4em;
    border-radius: 4px;
    font-size: 1rem;
    font-family: monospace;
  }

  .mono { font-family: monospace; }
</style>
