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
    onMilestoneChange   = () => {},
    onAutoRefreshToggle = () => {},
    onIntervalChange    = () => {},
    onManualRefresh     = () => {},
    notifCount    = 0,
    onNotifToggle = () => {},
    searchFilter     = '',
    onSearchChange   = () => {},
  } = $props()

  let selectedRelease = $derived(releases[selectedIndex])

  let isDark = $state(true)
  let searchInputEl = $state(null)

  function handleGlobalKeydown(e) {
    if (e.key !== '/') return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    searchInputEl?.focus()
  }

  onMount(() => {
    isDark = localStorage.getItem('theme') !== 'light'
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    document.addEventListener('keydown', handleGlobalKeydown)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
  })

  function toggleTheme() {
    isDark = !isDark
    const theme = isDark ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }
</script>

<header class="header">
  <!-- Logo + title -->
  <div class="logo">
    <img src="https://assets.ubuntu.com/v1/82818827-CoF_white.svg" alt="Ubuntu" />
    <span class="title">Ubuntu Mission Control</span>
  </div>

  <span class="sep">|</span>

  <!-- Release selector -->
  <div class="milestone">
    {#if releases.length > 1}
      <select
        value={selectedIndex}
        onchange={e => onMilestoneChange(Number(e.target.value))}
      >
        {#each releases as r, i}
          <option value={i}>{r.release.charAt(0).toUpperCase() + r.release.slice(1)}</option>
        {/each}
      </select>
    {:else if selectedRelease}
      <span class="release-name">
        {selectedRelease.release.charAt(0).toUpperCase() + selectedRelease.release.slice(1)}
      </span>
    {/if}
    {#if selectedRelease}
      <span class="milestone-meta">
        {productCount} builds · {todayDisplay}
      </span>
    {/if}
  </div>

  <!-- Search filter -->
  <div class="search-box">
    <span class="search-icon">⌕</span>
    <input
      bind:this={searchInputEl}
      class="search-input"
      type="text"
      placeholder="Filter products… ( / )"
      value={searchFilter}
      oninput={e => onSearchChange(e.target.value)}
    />
    {#if searchFilter}
      <button class="search-clear" onclick={() => onSearchChange('')} title="Clear filter">✕</button>
    {/if}
  </div>

  <!-- Right side -->
  <div class="right">
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
    <button class="theme-toggle" onclick={toggleTheme} title="{isDark ? 'Switch to light mode' : 'Switch to dark mode'}">
      {isDark ? '☀' : '☾'}
    </button>
    <button
      class="notif-btn"
      class:has-badge={notifCount > 0}
      onclick={onNotifToggle}
      title="Notifications"
      aria-label="Open notifications{notifCount > 0 ? ` (${notifCount} unread)` : ''}"
    >
      ◉
      {#if notifCount > 0}
        <span class="notif-badge">{notifCount > 99 ? '99+' : notifCount}</span>
      {/if}
    </button>
    <div class="clock">{clockStr}</div>
  </div>
</header>

<style>
  .header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 1.35rem;
    padding: 0 1.35rem;
    height: 60px;
    background: var(--bg-panel);
    border-bottom: 2px solid var(--accent);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .logo img { height: 30px; }

  .title {
    font-size: 1.08rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .sep {
    color: var(--border-strong);
    user-select: none;
    flex-shrink: 0;
  }

  .milestone {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .milestone select {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text);
    padding: 0.2rem 0.55rem;
    border-radius: 3px;
    font-size: 0.96rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }

  .release-name {
    font-size: 0.96rem;
    font-weight: 700;
    color: var(--text);
  }

  .milestone-meta {
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    flex-shrink: 1;
    min-width: 0;
    max-width: 260px;
  }

  .search-icon {
    color: var(--text-muted);
    font-size: 0.95rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .search-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-family: inherit;
    font-size: 0.88rem;
    width: 100%;
    min-width: 0;
  }

  .search-input::placeholder {
    color: var(--text-dim);
  }

  .search-clear {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.78rem;
    padding: 0 0.15rem;
    line-height: 1;
    flex-shrink: 0;
  }
  .search-clear:hover {
    color: var(--text);
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .theme-toggle {
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, border-color 0.15s;
  }
  .theme-toggle:hover {
    color: var(--text);
    border-color: var(--accent);
  }

  .notif-btn {
    position: relative;
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 1.05rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, border-color 0.15s;
  }
  .notif-btn:hover {
    color: var(--text);
    border-color: var(--accent);
  }
  .notif-btn.has-badge {
    border-color: var(--accent);
    color: var(--text);
  }

  .notif-badge {
    position: absolute;
    top: -7px;
    right: -7px;
    background: var(--accent);
    color: #fff;
    font-size: 0.63rem;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    line-height: 1;
    pointer-events: none;
  }

  .clock {
    font-size: 1.32rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-normal);
    min-width: 6rem;
    text-align: right;
  }
</style>
