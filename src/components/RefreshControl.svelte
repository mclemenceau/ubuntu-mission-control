<script>
  import { fmtCountdown } from '../lib/utils.js'

  let {
    autoRefresh    = false,
    refreshInterval = 120,
    countdown      = null,
    isLoading      = false,
    lastUpdated    = null,
    onToggle       = () => {},
    onIntervalChange = () => {},
    onManualRefresh  = () => {},
  } = $props()

  const INTERVALS = [
    { label: '30 s',   value: 30   },
    { label: '1 min',  value: 60   },
    { label: '2 min',  value: 120  },
    { label: '5 min',  value: 300  },
    { label: '10 min', value: 600  },
  ]
</script>

<div class="refresh-control">
  {#if lastUpdated}
    <span class="last-updated">Updated {lastUpdated}</span>
  {/if}

  {#if autoRefresh && countdown !== null}
    <span class="countdown">↻ {fmtCountdown(countdown)}</span>
  {/if}

  <!-- Auto-refresh toggle -->
  <label class="toggle" title="Auto-refresh">
    <input
      type="checkbox"
      checked={autoRefresh}
      onchange={e => onToggle(e.target.checked)}
    />
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
    <span class="toggle-label">Auto</span>
  </label>

  <!-- Interval selector (only visible when auto-refresh is on) -->
  {#if autoRefresh}
    <select
      class="interval-select"
      value={refreshInterval}
      onchange={e => onIntervalChange(Number(e.target.value))}
    >
      {#each INTERVALS as { label, value }}
        <option {value}>{label}</option>
      {/each}
    </select>
  {/if}

  <!-- Manual refresh button -->
  <button
    class="refresh-btn"
    class:loading={isLoading}
    disabled={isLoading}
    onclick={onManualRefresh}
    title="Refresh now"
  >
    ↺ Refresh
  </button>
</div>

<style>
  .refresh-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .last-updated {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .countdown {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    min-width: 3.5rem;
  }

  /* Toggle switch */
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle input { display: none; }

  .toggle-track {
    width: 28px;
    height: 16px;
    background: #333;
    border-radius: 8px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle input:checked + .toggle-track {
    background: var(--accent);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(12px);
  }

  .toggle-label {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  /* Interval select */
  .interval-select {
    background: var(--bg-raised);
    border: 1px solid #333;
    color: var(--text);
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.9rem;
    cursor: pointer;
  }

  /* Refresh button */
  .refresh-btn {
    background: var(--bg-raised);
    border: 1px solid #444;
    color: #ccc;
    padding: 0.3rem 0.8rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.975rem;
    transition: border-color 0.15s, color 0.15s;
    font-family: inherit;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .refresh-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .refresh-btn.loading {
    animation: pulse 0.8s infinite;
  }
</style>
