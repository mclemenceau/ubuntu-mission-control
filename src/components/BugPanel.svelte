<script>
  let {
    open    = false,
    bugs    = [],   // [{ id, artifacts, testers, url }]
    onClose = () => {},
  } = $props()
</script>

{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
{/if}

<aside class="panel" class:open aria-label="Bugs" aria-hidden={!open}>
  <div class="panel-header">
    <span class="panel-title">Bugs Filed</span>
    <span class="bug-count">{bugs.length} unique</span>
    <button class="close-btn" onclick={onClose} aria-label="Close bug panel">✕</button>
  </div>

  <div class="panel-body">
    {#if bugs.length === 0}
      <div class="empty">No bugs recorded for the current selection.</div>
    {:else}
      {#each bugs as bug (bug.id)}
        <a
          class="bug-row"
          href={bug.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open LP bug #{bug.id}"
        >
          <div class="bug-icon">▲</div>
          <div class="bug-body">
            <div class="bug-title">Bug #{bug.id}</div>
            <div class="bug-detail">{bug.artifacts}</div>
            {#if bug.testers}
              <div class="bug-tester">{bug.testers}</div>
            {/if}
          </div>
          <div class="bug-ext">↗</div>
        </a>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
    background: transparent;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 360px;
    z-index: 200;
    background: var(--bg-panel);
    border-left: 1px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
  }

  .panel.open {
    transform: translateX(0);
  }

  /* ── Header ── */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
    height: 60px;
    border-bottom: 1px solid var(--border-mid);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    flex: 1;
  }

  .bug-count {
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    line-height: 1;
    border-radius: 3px;
    transition: color 0.15s;
  }
  .close-btn:hover { color: var(--text); }

  /* ── Body ── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0;
  }

  .empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
  }

  /* ── Bug row ── */
  .bug-row {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
  }
  .bug-row:hover {
    background: var(--surface-hover);
  }

  .bug-icon {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.85rem;
    font-weight: 700;
    margin-top: 0.1rem;
    background: var(--amber-bg);
    border: 1px solid var(--amber-border);
    color: var(--amber);
  }

  .bug-body {
    flex: 1;
    min-width: 0;
  }

  .bug-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-bright);
    margin-bottom: 0.15rem;
    font-variant-numeric: tabular-nums;
  }

  .bug-detail {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bug-tester {
    font-size: 0.75rem;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.1rem;
  }

  .bug-ext {
    flex-shrink: 0;
    color: var(--text-dim);
    font-size: 0.75rem;
    padding-top: 0.25rem;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .bug-row:hover .bug-ext {
    opacity: 1;
  }
</style>
