<script>
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
  } = $props()

  let selectedRelease = $derived(releases[selectedIndex])
</script>

<header class="header">
  <!-- Logo + title -->
  <div class="logo">
    <img src="https://assets.ubuntu.com/v1/82818827-CoF_white.svg" alt="Ubuntu" />
    <span class="title">Release Mission Control</span>
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
    color: #444;
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
    border: 1px solid #333;
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

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .clock {
    font-size: 1.32rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #ccc;
    min-width: 6rem;
    text-align: right;
  }
</style>
