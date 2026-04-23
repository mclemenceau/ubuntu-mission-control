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
  import CelebrationOverlay from './components/CelebrationOverlay.svelte'

  // ── Milestone ──────────────────────────────────────────────────
  let releases      = $state([])
  let selectedIndex = $state(0)

  // ── Data ──────────────────────────────────────────────────────
  let products   = $state([])
  let kpiDeltas  = $state(null)
  let kpis = $derived(products.length > 0 ? computeKpis(products) : null)

  // ── Search filter ──────────────────────────────────────────────
  let searchFilter = $state('')
  let filteredProducts = $derived.by(() => {
    const q = searchFilter.trim().toLowerCase()
    if (q === '') return products
    return products.filter(p =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.displayName ?? '').toLowerCase().includes(q) ||
      (p.type ?? '').toLowerCase().includes(q) ||
      (p.arch ?? '').toLowerCase().includes(q) ||
      (p.version ?? '').toLowerCase().includes(q)
    )
  })

  // ── Modal ─────────────────────────────────────────────────────
  let selectedProduct = $state(null)

  // ── All-approved celebration ───────────────────────────────────
  let showCelebration = $state(false)
  let _celebrationTriggered = false

  let allApproved = $derived.by(() => {
    const nonRejected = products.filter(p => p.status !== 'MARKED_AS_FAILED')
    return nonRejected.length > 0 && nonRejected.every(p => p.status === 'APPROVED')
  })

  $effect(() => {
    if (allApproved) {
      if (!_celebrationTriggered) {
        _celebrationTriggered = true
        showCelebration = true
        playCelebrationFanfare()
      }
    } else {
      _celebrationTriggered = false
    }
  })

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

  function playCelebrationFanfare() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()

      function tone(freq, start, duration, vol = 0.22, type = 'sine') {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = type
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(vol, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
        osc.start(start)
        osc.stop(start + duration + 0.05)
      }

      const t = ctx.currentTime

      // Ascending arpeggio: C4 E4 G4 C5 E5
      tone(261.6, t + 0.00, 0.35, 0.20)
      tone(329.6, t + 0.12, 0.35, 0.20)
      tone(392.0, t + 0.24, 0.35, 0.20)
      tone(523.2, t + 0.36, 0.45, 0.22)
      tone(659.2, t + 0.50, 0.55, 0.22)

      // Triumphant chord stab
      tone(261.6, t + 0.75, 0.70, 0.18)
      tone(329.6, t + 0.75, 0.70, 0.18)
      tone(392.0, t + 0.75, 0.70, 0.18)
      tone(523.2, t + 0.75, 0.70, 0.20)

      // Second chord hit (higher)
      tone(392.0, t + 1.20, 0.60, 0.16)
      tone(493.9, t + 1.20, 0.60, 0.16)
      tone(587.3, t + 1.20, 0.60, 0.16)
      tone(783.9, t + 1.20, 0.60, 0.18)

      // Victory high notes flourish
      tone(1046.5, t + 1.65, 0.30, 0.14)
      tone(1174.7, t + 1.80, 0.30, 0.14)
      tone(1318.5, t + 1.95, 0.50, 0.16)

      // Final big chord
      tone(261.6,  t + 2.20, 1.20, 0.16)
      tone(329.6,  t + 2.20, 1.20, 0.16)
      tone(392.0,  t + 2.20, 1.20, 0.16)
      tone(523.2,  t + 2.20, 1.20, 0.18)
      tone(1046.5, t + 2.20, 1.20, 0.14)

      // Sparkle overtones (triangle wave for softness)
      tone(2093.0, t + 2.20, 0.80, 0.08, 'triangle')
      tone(2637.0, t + 2.40, 0.60, 0.06, 'triangle')
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
    {searchFilter}
    onSearchChange={v => searchFilter = v}
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

  {#if showCelebration}
    <CelebrationOverlay onDismiss={() => showCelebration = false} />
  {/if}

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
      <ProductGrid products={filteredProducts} onSelectProduct={p => selectedProduct = p} />
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
