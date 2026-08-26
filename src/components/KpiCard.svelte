<script>
  /**
   * @type {{
   *   label: string, value: string|number, sub: string,
   *   pct: number|null, color?: string, delta?: number,
   *   onclick?: (() => void)|null
   * }}
   */
  let { label, value, sub, pct, color = 'neutral', delta = 0, onclick = null } = $props()
</script>

<!-- Render as <button> when clickable, plain <div> otherwise -->
{#snippet inner()}
  <div class="label">{label}</div>
  <div class="value-row">
    <div class="value">{value}</div>
    {#key delta}
      {#if delta !== 0}
        <span class="delta" class:delta-pos={delta > 0} class:delta-neg={delta < 0}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      {/if}
    {/key}
  </div>
  <div class="sub">{sub}</div>
  <div class="bar">
    <div class="bar-fill" style="width: {pct ?? 0}%"></div>
  </div>
{/snippet}

{#if onclick}
  <button
    class="kpi clickable"
    class:green={color === 'green'}
    class:amber={color === 'amber'}
    class:red={color === 'red'}
    class:blue={color === 'blue'}
    {onclick}
  >{@render inner()}</button>
{:else}
  <div
    class="kpi"
    class:green={color === 'green'}
    class:amber={color === 'amber'}
    class:red={color === 'red'}
    class:blue={color === 'blue'}
  >{@render inner()}</div>
{/if}

<style>
  .kpi {
    padding: 1rem 1.5rem;
    border-right: 1px solid var(--border);
    position: relative;
    overflow: hidden;
    /* Reset button defaults when rendered as <button> */
    background: inherit;
    border-top: none;
    border-bottom: none;
    border-left: none;
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
  }

  .kpi.clickable {
    cursor: pointer;
    transition: background 0.15s;
  }
  .kpi.clickable:hover { background: var(--surface-hover); }
  .kpi.clickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 0.4rem;
  }

  .value-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .value {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    transition: color 0.3s;
  }

  .delta {
    font-size: 1.1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 0.1em 0.4em;
    border-radius: 4px;
    animation: delta-pop 12s ease-out forwards;
    flex-shrink: 0;
  }

  .delta-pos {
    color: #5ddb5d;
    background: rgba(93, 219, 93, 0.12);
  }

  .delta-neg {
    color: var(--red);
    background: rgba(220, 60, 60, 0.12);
  }

  @keyframes delta-pop {
    0%   { opacity: 1; transform: scale(1.15); }
    8%   { opacity: 1; transform: scale(1); }
    60%  { opacity: 0.7; }
    100% { opacity: 0; }
  }

  .sub {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 0.3rem;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    margin-top: 0.5rem;
    height: 4px;
    background: var(--bg-raised);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--text-dim);
    transition: width 0.6s ease, background 0.3s;
  }

  /* Color variants */
  .green .value  { color: var(--green); }
  .green .bar-fill { background: var(--green); }

  .amber .value  { color: var(--amber); }
  .amber .bar-fill { background: var(--amber); }

  .red .value    { color: var(--red); }
  .red .bar-fill { background: var(--red); }

  .blue .value   { color: var(--blue); }
  .blue .bar-fill { background: var(--blue); }
</style>
