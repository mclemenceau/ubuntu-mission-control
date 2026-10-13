<script>
  import cofOrange from '../assets/cof-orange.png'

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

  const FLAVOR_ICONS = {
    edubuntu:        'https://assets.ubuntu.com/v1/a2f090ef-edubuntu-logo.svg',
    kubuntu:         'https://assets.ubuntu.com/v1/d92401b4-kubuntu-logo.svg',
    lubuntu:         'https://assets.ubuntu.com/v1/6ac4ba34-lubuntu-logo.svg',
    'ubuntu-budgie': 'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    budgie:          'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    'ubuntu-cinnamon':'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    cinnamon:        'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    'ubuntu-kylin':  'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    kylin:           'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    'ubuntu-mate':   'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    mate:            'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    'ubuntu-studio': 'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    studio:          'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    'ubuntu-unity':  'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    unity:           'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    xubuntu:         'https://assets.ubuntu.com/v1/36e8f12b-Xubuntu_logo.svg',
  }

  const UBUNTU_DEFAULT = cofOrange

  let flavorIcon = $derived.by(() => {
    const n = ((product.name ?? '') + ' ' + (product.displayName ?? '')).toLowerCase()
    for (const [key, url] of Object.entries(FLAVOR_ICONS)) {
      if (n.includes(key)) return url
    }
    return UBUNTU_DEFAULT
  })

  let isStale = $derived((product.ageDays ?? 999) > 7)

  // Orange-red at 8d fading to grey at 28d+
  let staleColor = $derived.by(() => {
    if (!isStale) return null
    const t = Math.min(((product.ageDays ?? 999) - 7) / 21, 1)
    const s = Math.round(78 - t * 65)
    const l = Math.round(48 - t * 18)
    return `hsl(30,${s}%,${l}%)`
  })

  // Glow color by change kind
  const GLOW_COLORS = {
    approved: '80, 200, 80',
    failed:   '220, 60, 60',
    tests:    '80, 160, 255',
    status:   '255, 200, 60',
    new:      '80, 160, 255',
  }
  let glowColor = $derived(GLOW_COLORS[product._changeKind] ?? '80, 160, 255')
</script>

<button
  class="chip {cardClass}"
  {onclick}
  title="{product.name} · {product.version}"
>
  {#key product._changedAt}
    {#if product._changedAt}
      <div class="glow-ring" style="--glow-rgb: {glowColor}"></div>
    {/if}
  {/key}
  <div class="chip-top">
    <span class="chip-name">{product.displayName}</span>
    {#if statusIcon}
      <span class="chip-icon">{statusIcon}</span>
    {/if}
    <img class="flavor-icon" src={flavorIcon} alt="" aria-hidden="true" />
  </div>
  <div class="chip-middle">
    <span>{product.arch}</span>
    <span>{product.type}</span>
  </div>
  <div class="chip-bottom">
    <span class="chip-version">{product.version}</span>
    {#if hasTests}
      {#if product.tests.passed}    <span class="tc mc-text--positive">✓{product.tests.passed}</span>{/if}
      {#if product.tests.failed}    <span class="tc mc-text--negative">✗{product.tests.failed}</span>{/if}
      {#if product.tests.inProgress}<span class="tc mc-text--information">●{product.tests.inProgress}</span>{/if}
      {#if product.tests.notStarted}<span class="tc u-text--muted">○{product.tests.notStarted}</span>{/if}
    {/if}
  </div>
  {#if isStale && product.ageDays !== null}
    <span class="age-badge" style="color:{staleColor}">{product.ageDays}d</span>
  {/if}
</button>

<style>
  .chip {
    background: var(--vf-color-background-default);
    border: 1px solid var(--vf-color-border-low-contrast);
    border-left: 4px solid var(--vf-color-border-high-contrast);
    border-radius: 0;
    color: var(--vf-color-text-default);
    display: flex;
    flex-direction: column;
    height: 5.5rem;
    justify-content: space-between;
    margin: 0;
    min-width: 20rem;
    padding: 0.5rem 0.875rem 0.5rem 1rem;
    position: relative;
    text-align: left;
    transition: transform 0.12s, box-shadow 0.12s, background-color 0.12s;
  }

  .chip:hover {
    background-color: var(--vf-color-background-hover);
    box-shadow: 0 2px 8px var(--mc-shadow);
    transform: translateY(-1px);
  }

  .chip.approved {
    background: var(--vf-color-background-positive-default);
    border-color: var(--vf-color-border-positive);
    border-left-color: var(--mc-positive);
  }
  .chip.approved:hover { background: var(--vf-color-background-positive-hover); }

  .chip.failed {
    background: var(--vf-color-background-negative-default);
    border-color: var(--vf-color-border-negative);
    border-left-color: var(--mc-negative);
  }
  .chip.failed:hover { background: var(--vf-color-background-negative-hover); }

  .flavor-icon {
    flex-shrink: 0;
    height: 1.25rem;
    object-fit: contain;
    width: 1.25rem;
  }

  /* ── Top row: name + status icon ─── */
  .chip-top {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    overflow: hidden;
  }

  .chip-name {
    flex: 1;
    font-size: 1.125rem;
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-icon {
    flex-shrink: 0;
    font-weight: 700;
  }
  .approved .chip-icon { color: var(--mc-positive); }
  .failed .chip-icon   { color: var(--mc-negative); }

  /* ── Middle + bottom rows: arch/type, version + test counts ─── */
  .chip-bottom {
    align-items: center;
    display: flex;
    gap: 0.375rem;
  }

  .chip-middle, .chip-version {
    color: var(--vf-color-text-muted);
    flex-shrink: 0;
    margin-right: 0.25rem;
  }

  .chip-middle span + span:before {
    content: " - "
  }

  .tc {
    font-variant-numeric: tabular-nums;
    font-weight: 550;
  }

  .age-badge {
    bottom: 0.25rem;
    font-family: var(--mc-font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
    position: absolute;
    right: 0.5rem;
  }

  /* Change glow-flash overlay — fades out over 15 s */
  .glow-ring {
    animation: glow-fade 15s ease-out forwards;
    box-shadow: 0 0 0 3px rgba(var(--glow-rgb), 0.85),
                0 0 18px 4px rgba(var(--glow-rgb), 0.5);
    inset: -1px;
    pointer-events: none;
    position: absolute;
    z-index: 2;
  }

  @keyframes glow-fade {
    0%   { opacity: 1; }
    20%  { opacity: 0.85; }
    60%  { opacity: 0.4; }
    100% { opacity: 0; }
  }
</style>
