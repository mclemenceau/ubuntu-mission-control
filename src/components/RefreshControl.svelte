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
    <span class="u-text--muted">Updated {lastUpdated}</span>
  {/if}

  {#if autoRefresh && countdown !== null}
    <span class="countdown">↻ {fmtCountdown(countdown)}</span>
  {/if}

  <label class="p-switch">
    <input
      type="checkbox"
      class="p-switch__input"
      role="switch"
      checked={autoRefresh}
      onchange={e => onToggle(e.target.checked)}
    />
    <span class="p-switch__slider"></span>
    <span class="p-switch__label">Auto</span>
  </label>

  {#if autoRefresh}
    <label class="u-off-screen" for="refresh-interval">Refresh interval</label>
    <select
      id="refresh-interval"
      value={refreshInterval}
      onchange={e => onIntervalChange(Number(e.target.value))}
    >
      {#each INTERVALS as { label, value }}
        <option {value}>{label}</option>
      {/each}
    </select>
  {/if}

  <button
    class="p-button is-dense has-icon"
    class:loading={isLoading}
    disabled={isLoading}
    onclick={onManualRefresh}
    title="Refresh now"
  >
    <i class="p-icon--restart"></i>
    <span>Refresh</span>
  </button>
</div>

<style>
  .refresh-control {
    align-items: center;
    display: flex;
    gap: 1rem;
    white-space: nowrap;
  }

  .countdown {
    font-variant-numeric: tabular-nums;
    font-weight: 550;
    min-width: 3.5rem;
  }

  .p-switch {
    margin: 0;
    padding: 0;
  }

  select {
    margin: 0;
    width: auto;
  }

  button {
    margin: 0;
  }

  .loading {
    animation: pulse 0.8s infinite;
  }
</style>
