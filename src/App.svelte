<script>
  import { onMount, onDestroy } from 'svelte'
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
  import ProductModal from './components/ProductModal.svelte'
  import NotificationPanel from './components/NotificationPanel.svelte'
  import { generateNotifications } from './lib/notifications.js'

  // ── Milestone ──────────────────────────────────────────────────
  let releases      = $state([])
  let selectedIndex = $state(0)

  // ── Data ──────────────────────────────────────────────────────
  let products   = $state([])
  let kpiDeltas  = $state(null)
  let kpis = $derived(products.length > 0 ? computeKpis(products) : null)

  // ── Modal ─────────────────────────────────────────────────────
  let selectedProduct = $state(null)

  // ── Notifications ──────────────────────────────────────────────
  let notifications = $state([])
  let notifOpen     = $state(false)
  let unreadCount   = $derived(notifications.filter(n => !n.read).length)

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
      // Phase 1 — artifacts
      loadLabel = 'Loading artifacts…'
      loadPct   = 5
      const artefacts = await fetchArtefacts()

      // Derive available releases from API response (first load only)
      if (releases.length === 0) {
        releases = [...new Set(artefacts.map(a => a.release))].sort().reverse().map(r => ({ release: r }))
      }
      const ms = releases[selectedIndex] ?? releases[0]

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
        const prevKpis = products.length > 0 ? computeKpis(products) : null
        const { products: merged, changed } = diffProducts(products, items)
        if (changed) {
          // Generate notifications from changed products before updating state
          const changedItems = merged.filter(p => p._changeKind)
          const newNotifs = generateNotifications(changedItems)
          if (newNotifs.length > 0) {
            notifications = [...newNotifs.map(n => ({ ...n, read: false })), ...notifications]
            playUpdateSound()
          }
          products = merged
          if (prevKpis) {
            const nextKpis = computeKpis(merged)
            const dBuilds    = nextKpis.buildsToday - prevKpis.buildsToday
            const dApproved  = nextKpis.approved.count - prevKpis.approved.count
            const dTests     = nextKpis.tests.total - prevKpis.tests.total
            const dPassed    = nextKpis.tests.passed - prevKpis.tests.passed
            const dBugs      = nextKpis.bugs - prevKpis.bugs
            if (dBuilds || dApproved || dTests || dPassed || dBugs) {
              kpiDeltas = { builds: dBuilds, approved: dApproved, tests: dTests, passed: dPassed, bugs: dBugs }
            }
          }
        }
      } else {
        products  = [...items]
        kpiDeltas = null
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
  // Notification sound
  // ──────────────────────────────────────────────────────────────
  function playUpdateSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      // Two-tone chime: a quick high note followed by a lower one
      const tones = [880, 660]
      tones.forEach((freq, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = ctx.currentTime + i * 0.15
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
        osc.start(start)
        osc.stop(start + 0.25)
      })
    } catch {
      // AudioContext not available — silently skip
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
  // Notification handlers
  // ──────────────────────────────────────────────────────────────
  function openNotifPanel() {
    notifOpen = true
    // Mark all as read when the panel is opened
    if (notifications.some(n => !n.read)) {
      notifications = notifications.map(n => ({ ...n, read: true }))
    }
  }

  function closeNotifPanel() {
    notifOpen = false
  }

  function clearNotifications() {
    notifications = []
  }

  function dismissNotification(id) {
    notifications = notifications.filter(n => n.id !== id)
  }

  function onNotifClick(productId) {
    const product = products.find(p => p.id === productId)
    if (!product) return
    notifOpen = false
    selectedProduct = product
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
    notifCount={unreadCount}
    {onMilestoneChange}
    onAutoRefreshToggle={onAutoRefreshToggle}
    {onIntervalChange}
    {onManualRefresh}
    onNotifToggle={openNotifPanel}
  />

  <NotificationPanel
    open={notifOpen}
    {notifications}
    onClose={closeNotifPanel}
    onClearAll={clearNotifications}
    onDismiss={dismissNotification}
    {onNotifClick}
  />

  {#if selectedProduct}
    <ProductModal product={selectedProduct} onclose={() => selectedProduct = null} />
  {/if}

  {#if kpis}
    <KpiRow {kpis} deltas={kpiDeltas} />
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
      <ProductGrid {products} onSelectProduct={p => selectedProduct = p} />
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

</style>
