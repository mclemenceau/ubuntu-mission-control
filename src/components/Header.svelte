<script>
  import { onMount, onDestroy } from 'svelte'
  import RefreshControl from './RefreshControl.svelte'

  let {
    releases         = [],
    selectedIndex    = 0,
    clockStr         = '—',
    todayDisplay     = '',
    lastUpdated      = null,
    autoRefresh      = false,
    refreshInterval  = 120,
    countdown        = null,
    isLoading        = false,
    productCount     = null,
    activePage       = 'artifacts',
    onPageChange     = () => {},
    onMilestoneChange   = () => {},
    onAutoRefreshToggle = () => {},
    onIntervalChange    = () => {},
    onManualRefresh     = () => {},
    notifCount    = 0,
    onNotifToggle = () => {},
    searchFilter     = '',
    onSearchChange   = () => {},
  } = $props()

  const PAGES = [
    { id: 'artifacts', label: 'Artifacts' },
    { id: 'testing',   label: 'Testing'   },
  ]

  let selectedRelease = $derived(releases[selectedIndex])

  let isDark = $state(false)
  let searchInputEl = $state(null)

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function applyTheme() {
    const root = document.documentElement
    root.classList.toggle('is-dark', isDark)
    root.classList.toggle('is-light', !isDark)
  }

  function handleGlobalKeydown(e) {
    if (e.key !== '/') return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    searchInputEl?.focus()
  }

  onMount(() => {
    try {
      isDark = localStorage.getItem('theme') === 'dark'
    } catch {
      isDark = false
    }
    applyTheme()
    document.addEventListener('keydown', handleGlobalKeydown)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
  })

  function toggleTheme() {
    isDark = !isDark
    applyTheme()
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {
      // Storage unavailable: the choice just won't persist.
    }
  }
</script>

<header class="p-navigation is-dark header">
  <div class="p-navigation__row--full-width">
    <div class="p-navigation__banner">
      <div class="p-navigation__tagged-logo">
        <a class="p-navigation__link" href="./">
          <div class="p-navigation__logo-tag">
            <img
              class="p-navigation__logo-icon"
              src="https://assets.ubuntu.com/v1/82818827-CoF_white.svg"
              alt=""
            />
          </div>
          <span class="p-navigation__logo-title">Ubuntu Mission Control</span>
        </a>
      </div>
    </div>

    <nav class="p-navigation__nav" aria-label="Pages">
      <ul class="p-navigation__items">
        {#each PAGES as page}
          <li
            class="p-navigation__item"
            class:is-selected={activePage === page.id}
          >
            <button
              class="p-navigation__link"
              aria-current={activePage === page.id ? 'page' : undefined}
              onclick={() => onPageChange(page.id)}
            >{page.label}</button>
          </li>
        {/each}
      </ul>

      <div class="nav-end">
        <button
          class="p-button--base is-dense"
          onclick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >{isDark ? '☀ Light' : '☾ Dark'}</button>
        <button
          class="p-button--base is-dense has-icon"
          onclick={onNotifToggle}
          title="Notifications"
          aria-label="Open notifications{notifCount > 0
            ? ` (${notifCount} unread)` : ''}"
        >
          <i class="p-icon--notifications"></i>
          {#if notifCount > 0}
            <span class="p-badge">{notifCount > 99 ? '99+' : notifCount}</span>
          {/if}
        </button>
        <span class="clock">{clockStr}</span>
      </div>
    </nav>
  </div>
</header>

<div class="toolbar">
  <div class="release">
    {#if releases.length > 1}
      <label class="u-off-screen" for="release-select">Release</label>
      <select
        id="release-select"
        value={selectedIndex}
        onchange={e => onMilestoneChange(Number(e.target.value))}
      >
        {#each releases as r, i}
          <option value={i}>{capitalize(r.release)}</option>
        {/each}
      </select>
    {:else if selectedRelease}
      <strong>{capitalize(selectedRelease.release)}</strong>
    {/if}
    {#if selectedRelease}
      <span class="u-text--muted">{productCount} builds · {todayDisplay}</span>
    {/if}
  </div>

  <form
    class="p-search-box search"
    role="search"
    onsubmit={e => e.preventDefault()}
    onreset={() => onSearchChange('')}
  >
    <label class="u-off-screen" for="product-filter">Filter products</label>
    <input
      bind:this={searchInputEl}
      id="product-filter"
      class="p-search-box__input"
      type="search"
      required
      placeholder="Filter products ( / )"
      autocomplete="off"
      value={searchFilter}
      oninput={e => onSearchChange(e.target.value)}
    />
    <button type="reset" class="p-search-box__reset" title="Clear filter">
      <i class="p-icon--close">Clear</i>
    </button>
    <button type="submit" class="p-search-box__button" tabindex="-1">
      <i class="p-icon--search">Search</i>
    </button>
  </form>

  <div class="toolbar-end">
    <RefreshControl
      {autoRefresh}
      {refreshInterval}
      {countdown}
      {isLoading}
      {lastUpdated}
      onToggle={onAutoRefreshToggle}
      {onIntervalChange}
      {onManualRefresh}
    />
  </div>
</div>

<style>
  .header {
    flex-shrink: 0;
  }

  /* The dashboard is a desktop tool: keep the page links visible at
     every width instead of collapsing them behind a menu toggle. */
  .header :global(.p-navigation__nav),
  .header :global(.p-navigation__items) {
    display: flex;
    flex-direction: row;
  }

  .header :global(.p-navigation__nav) {
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .header :global(.p-navigation__tagged-logo) {
    margin-right: 1.5rem;
    white-space: nowrap;
  }

  .header :global(.p-navigation__item .p-navigation__link) {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .nav-end {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  .nav-end button {
    margin: 0;
  }

  .nav-end .p-badge {
    margin-left: 0.25rem;
  }

  .clock {
    font-size: 1.25rem;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
    margin-left: 0.5rem;
    min-width: 5.5rem;
    text-align: right;
  }

  .toolbar {
    align-items: center;
    background: var(--vf-color-background-default);
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
    flex-shrink: 0;
    gap: 1.5rem;
    padding: 0.5rem 1.5rem;
  }

  .release {
    align-items: center;
    display: flex;
    gap: 0.75rem;
    white-space: nowrap;
  }

  .release select {
    margin: 0;
    min-width: 9rem;
    width: auto;
  }

  .search {
    flex: 0 1 18rem;
    margin: 0;
    min-width: 10rem;
  }

  .toolbar-end {
    margin-left: auto;
  }
</style>
