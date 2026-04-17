<script>
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

  const UBUNTU_DEFAULT = 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png'

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
      <span class="chip-icon {cardClass}">{statusIcon}</span>
    {/if}
    <img class="flavor-icon" src={flavorIcon} alt="" aria-hidden="true" />
  </div>
  <span class="chip-arch">{product.arch}</span>
  <div class="chip-bottom">
    <span class="chip-version">{product.version}</span>
    {#if hasTests}
      {#if product.tests.passed}    <span class="tc pass">✓{product.tests.passed}</span>{/if}
      {#if product.tests.failed}    <span class="tc fail">✗{product.tests.failed}</span>{/if}
      {#if product.tests.inProgress}<span class="tc prog">●{product.tests.inProgress}</span>{/if}
      {#if product.tests.notStarted}<span class="tc skip">○{product.tests.notStarted}</span>{/if}
    {/if}
  </div>
  {#if isStale && product.ageDays !== null}
    <span class="age-badge" style="color:{staleColor}">{product.ageDays}d</span>
  {/if}
</button>

<style>
  .chip {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 224px;
    max-width: 336px;
    height: 74px;
    padding: 0.5rem 0.875rem 0.5rem 1rem;
    border-radius: 7px;
    border: 1px solid var(--border-subtle);
    border-left: 4px solid var(--border-mid);
    background: var(--bg-panel);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: filter 0.12s, transform 0.12s, box-shadow 0.12s;
  }

  .chip:hover {
    filter: brightness(1.25);
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  }

  .chip:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .chip:focus:not(:focus-visible) { outline: none; }

  .chip.approved {
    background: var(--green-bg);
    border-color: var(--green-border);
    border-left-color: var(--green);
  }
  .chip.failed {
    background: var(--red-bg);
    border-color: var(--red-border);
    border-left-color: var(--red);
  }
  .chip.default  { border-left-color: var(--border-mid); }

  .flavor-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
  }

  /* ── Top row: name + status icon ─── */
  .chip-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.44rem;
    overflow: hidden;
  }

  .chip-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-bright);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .chip-icon {
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .chip-icon.approved { color: var(--green); }
  .chip-icon.failed   { color: var(--red);   }

  /* ── Bottom row: arch + test counts ─── */
  .chip-bottom {
    display: flex;
    align-items: center;
    gap: 0.38rem;
  }

  .chip-arch, .chip-version {
    font-size: 1rem;
    color: var(--text-dim);
    flex-shrink: 0;
    margin-right: 0.18rem;
  }

  .tc {
    font-size: 0.98rem;
    font-weight: 700;
    padding: 0.05em 0.25em;
    border-radius: 3px;
    line-height: 1;
  }
  .tc.pass { color: #5ddb5d; }
  .tc.fail { color: var(--red); }
  .tc.prog { color: var(--blue); }
  .tc.skip { color: var(--text-dim); }

  .age-badge {
    position: absolute;
    bottom: 0.3rem;
    right: 0.45rem;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: monospace;
    line-height: 1;
    pointer-events: none;
  }

  /* Change glow-flash overlay — fades out over 15 s */
  .glow-ring {
    position: absolute;
    inset: -1px;
    border-radius: 7px;
    pointer-events: none;
    box-shadow: 0 0 0 3px rgba(var(--glow-rgb), 0.85),
                0 0 18px 4px rgba(var(--glow-rgb), 0.5);
    animation: glow-fade 15s ease-out forwards;
    z-index: 2;
  }

  @keyframes glow-fade {
    0%   { opacity: 1; }
    20%  { opacity: 0.85; }
    60%  { opacity: 0.4; }
    100% { opacity: 0; }
  }
</style>
