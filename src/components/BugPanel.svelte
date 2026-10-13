<script>
  import SidePanel from './SidePanel.svelte'

  let {
    open    = false,
    bugs    = [],   // [{ id, artifacts, testers, url }]
    onClose = () => {},
  } = $props()
</script>

<SidePanel {open} title="Bugs filed" {onClose}>
  {#snippet controls()}
    <span class="p-chip is-dense is-readonly">
      <span class="p-chip__value">{bugs.length} unique</span>
    </span>
  {/snippet}

  {#if bugs.length === 0}
    <p class="u-text--muted empty">No bugs recorded for the current selection.</p>
  {:else}
    {#each bugs as bug (bug.id)}
      <a
        class="bug-row"
        href={bug.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open LP bug #{bug.id}"
      >
        <i class="p-icon--submit-bug"></i>
        <span class="bug-body">
          <strong class="bug-title">Bug #{bug.id}</strong>
          <span class="bug-detail u-text--muted u-truncate">{bug.artifacts}</span>
          {#if bug.testers}
            <span class="bug-tester u-text--muted u-truncate">{bug.testers}</span>
          {/if}
        </span>
        <i class="p-icon--external-link bug-ext"></i>
      </a>
    {/each}
  {/if}
</SidePanel>

<style>
  .empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  .p-chip {
    margin: 0;
  }

  /* ── Bug row ── */
  .bug-row {
    align-items: flex-start;
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    color: inherit;
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
  }
  .bug-row:hover {
    background: var(--vf-color-background-hover);
  }

  .bug-row > i {
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .bug-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .bug-title {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    font-weight: 550;
  }

  .bug-detail {
    font-size: 0.875rem;
  }

  .bug-tester {
    font-size: 0.75rem;
  }

  .bug-ext {
    opacity: 0;
    transition: opacity 0.1s;
  }
  .bug-row:hover .bug-ext,
  .bug-row:focus-visible .bug-ext {
    opacity: 1;
  }
</style>
