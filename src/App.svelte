<script>
  import { onMount, onDestroy } from 'svelte'
  import { releases } from './lib/milestones.js'
  import {
    buildProductItems,
    enrichWithTestExecutions,
    enrichWithBugs,
    computeKpis,
    diffProducts,
  } from './lib/processor.js'
  import { fetchArtefacts } from './api/client.js'
  import { fmtTime, fmtDate } from './lib/utils.js'
  import Header from './components/Header.svelte'
  import KpiRow from './components/KpiRow.svelte'
  import ProductGrid from './components/ProductGrid.svelte'

  // ── Milestone ──────────────────────────────────────────────────
  let selectedIndex = $state(0)

  // ── Card age-style variant ─────────────────────────────────────
  let cardVariant = $state('B')

  // ── Data ──────────────────────────────────────────────────────
  let products = $state([])
  let kpis = $derived(products.length > 0 ? computeKpis(products) : null)

  // ── Load state ────────────────────────────────────────────────
  // loadPhase: null = idle, 'initial' = first load (shows overlay),
  //            'background' = silent background refresh
  let loadPhase = $state(null)
  let loadLabel = $state('')
  let loadPct   = $state(0)
  let loadError = $state(null)
  let lastUpdated = $state(null)

  // Plain variable (not reactive) — guards against concurrent loads
  let _loading = false

  // ── Refresh settings ──────────────────────────────────────────
  let autoRefresh     = $state(false)
  let refreshInterval = $state(120)
  let countdown       = $state(null)
  let _countdownTimer = null

  // ── Clock ─────────────────────────────────────────────────────
  let clockStr = $state('—')
  let _clockTimer = null

  // ──────────────────────────────────────────────────────────────
  // Data pipeline
  // ──────────────────────────────────────────────────────────────
  async function loadDashboard(background = false) {
    if (_loading) return
    _loading  = true
    loadError = null
    loadPhase = background ? 'background' : 'initial'
    loadPct   = 0

    try {
      const ms = releases[selectedIndex]

      // Phase 1 — artifacts
      loadLabel = 'Loading artifacts…'
      loadPct   = 5
      const artefacts = await fetchArtefacts()

      loadLabel = "Filtering today's builds…"
      loadPct   = 15
      const items = buildProductItems(artefacts, ms)

      // Render Phase 1 immediately on initial load
      if (!background) {
        products = [...items]
      }

      // Phase 2 — test executions
      loadLabel = 'Fetching test executions…'
      loadPct   = 30
      await enrichWithTestExecutions(items, (done, total) => {
        loadPct = 30 + Math.round((done / total) * 25)
      })

      if (!background) {
        products = [...items]
      }

      // Phase 3 — bug extraction
      loadLabel = 'Analysing test results…'
      loadPct   = 55
      await enrichWithBugs(items, (done, total) => {
        loadPct = 55 + Math.round((done / total) * 40)
      })

      // Merge: background diff preserves object identity for unchanged cards
      if (background) {
        const { products: merged, changed } = diffProducts(products, items)
        if (changed) products = merged
      } else {
        products = [...items]
      }

      lastUpdated = fmtTime(new Date())

    } catch (err) {
      console.error('Dashboard error:', err)
      loadError = err.message
    } finally {
      _loading  = false
      loadPhase = null
      if (autoRefresh) _startCountdown()
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Refresh timer
  // ──────────────────────────────────────────────────────────────
  function _startCountdown() {
    _stopCountdown()
    countdown = refreshInterval
    _countdownTimer = setInterval(() => {
      countdown -= 1
      if (countdown <= 0) {
        _stopCountdown()
        loadDashboard(true)
      }
    }, 1000)
  }

  function _stopCountdown() {
    clearInterval(_countdownTimer)
    _countdownTimer = null
    countdown = null
  }

  // ──────────────────────────────────────────────────────────────
  // Event handlers (passed as props to child components)
  // ──────────────────────────────────────────────────────────────
  function onMilestoneChange(index) {
    selectedIndex = index
    _stopCountdown()
    products = []
    loadDashboard(false)
  }

  function onAutoRefreshToggle(enabled) {
    autoRefresh = enabled
    if (enabled) _startCountdown()
    else _stopCountdown()
  }

  function onIntervalChange(secs) {
    refreshInterval = secs
    if (autoRefresh) _startCountdown()
  }

  function onManualRefresh() {
    _stopCountdown()
    // Use background mode if we already have data (avoids overlay flash)
    loadDashboard(products.length > 0)
  }

  // ──────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────
  onMount(() => {
    clockStr   = fmtTime(new Date())
    _clockTimer = setInterval(() => { clockStr = fmtTime(new Date()) }, 1000)
    loadDashboard(false)
  })

  onDestroy(() => {
    _stopCountdown()
    clearInterval(_clockTimer)
  })
</script>

<div class="shell">
  <Header
    {releases}
    {selectedIndex}
    {clockStr}
    todayDisplay={fmtDate(new Date())}
    {lastUpdated}
    {autoRefresh}
    {refreshInterval}
    {countdown}
    isLoading={loadPhase !== null}
    productCount={products.length}
    {onMilestoneChange}
    onAutoRefreshToggle={onAutoRefreshToggle}
    {onIntervalChange}
    {onManualRefresh}
  />

  {#if kpis}
    <KpiRow {kpis} />
  {/if}

  <div class="grid-wrap">
    {#if loadPhase === 'initial'}
      <!-- Initial load overlay — not shown during background refresh -->
      <div class="loading-screen">
        <div class="loading-box">
          <div class="loading-title">Loading Data</div>
          <div class="loading-label">{loadLabel}</div>
          <div class="loading-track">
            <div class="loading-fill" style="width: {loadPct}%"></div>
          </div>
        </div>
      </div>
    {:else if loadError}
      <div class="error-msg">Error: {loadError}</div>
    {:else}
      <div class="grid-toolbar">
        <span class="toolbar-label">Age style</span>
        {#each [['default','Current'],['A','Stripe'],['B','Top bar'],['C','Pill']] as [v, label]}
          <button class="variant-btn" class:active={cardVariant === v} onclick={() => cardVariant = v}>{label}</button>
        {/each}
      </div>
      <ProductGrid {products} variant={cardVariant} />
    {/if}
  </div>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-base);
  }

  .grid-wrap {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.75rem 1rem;
  }

  /* Initial load screen */
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .loading-box {
    background: var(--bg-panel);
    border: 1px solid #333;
    border-radius: 6px;
    padding: 2rem 3rem;
    text-align: center;
    min-width: 320px;
  }

  .loading-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .loading-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    min-height: 1.25em;
  }

  .loading-track {
    height: 4px;
    background: var(--bg-raised);
    border-radius: 2px;
    overflow: hidden;
  }

  .loading-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .error-msg {
    color: var(--red);
    padding: 1rem 1.5rem;
    font-size: 0.875rem;
  }

  .grid-toolbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
  }

  .toolbar-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-right: 0.15rem;
  }

  .variant-btn {
    background: var(--bg-panel);
    border: 1px solid var(--border-faint);
    color: var(--text-dim);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.2em 0.65em;
    border-radius: 3px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .variant-btn:hover  { border-color: #555; color: #ccc; }
  .variant-btn.active { border-color: var(--accent); color: var(--accent); }
</style>
