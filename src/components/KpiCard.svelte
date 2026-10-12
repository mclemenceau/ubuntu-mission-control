<script>
  /**
   * @type {{
   *   label: string, value: string|number, sub: string,
   *   pct: number|null,
   *   tone?: 'positive'|'caution'|'negative'|'information'|'neutral',
   *   delta?: number,
   *   onclick?: (() => void)|null
   * }}
   */
  let {
    label, value, sub, pct, tone = 'neutral', delta = 0, onclick = null,
  } = $props()
</script>

<!-- Render as <button> when clickable, plain <div> otherwise -->
{#snippet inner()}
  <span class="mc-label">{label}</span>
  <span class="value-row">
    <span class="value">{value}</span>
    {#key delta}
      {#if delta !== 0}
        <span class="delta" class:mc-text--positive={delta > 0}
              class:mc-text--negative={delta < 0}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      {/if}
    {/key}
  </span>
  <span class="sub u-text--muted">{sub}</span>
  <span class="mc-progress">
    <span style="width: {pct ?? 0}%"></span>
  </span>
{/snippet}

{#if onclick}
  <button class="kpi clickable tone-{tone}" {onclick}>{@render inner()}</button>
{:else}
  <div class="kpi tone-{tone}">{@render inner()}</div>
{/if}

<style>
  .kpi {
    background: transparent;
    border: 0;
    border-radius: 0;
    border-right: 1px solid var(--vf-color-border-low-contrast);
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 1rem 1.5rem;
    text-align: left;
    width: 100%;
  }

  .kpi.clickable:hover {
    background: var(--vf-color-background-hover);
  }

  .value-row {
    align-items: baseline;
    display: flex;
    gap: 0.5rem;
  }

  .value {
    font-size: 2.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
    line-height: 3rem;
    transition: color 0.3s;
  }

  .delta {
    animation: delta-pop 12s ease-out forwards;
    background: var(--vf-color-background-neutral-default);
    flex-shrink: 0;
    font-size: 1.125rem;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
    padding: 0 0.4em;
  }

  @keyframes delta-pop {
    0%   { opacity: 1; transform: scale(1.15); }
    8%   { opacity: 1; transform: scale(1); }
    60%  { opacity: 0.7; }
    100% { opacity: 0; }
  }

  .sub {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }

  .mc-progress {
    display: block;
    margin-top: 0.25rem;
  }

  .tone-positive    { --mc-bar: var(--mc-positive); }
  .tone-caution     { --mc-bar: var(--mc-caution); }
  .tone-negative    { --mc-bar: var(--mc-negative); }
  .tone-information { --mc-bar: var(--mc-information); }
  .tone-neutral     { --mc-bar: var(--vf-color-text-muted); }

  .kpi:not(.tone-neutral) .value {
    color: var(--mc-bar);
  }
</style>
