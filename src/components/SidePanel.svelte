<script>
  /**
   * Slide-in side panel built on Vanilla's p-panel layout.
   * @type {{
   *   open?: boolean,
   *   title: string,
   *   width?: string,
   *   onClose?: () => void,
   *   controls?: import('svelte').Snippet,
   *   children?: import('svelte').Snippet,
   * }}
   */
  let {
    open     = false,
    title,
    width    = '22.5rem',
    onClose  = () => {},
    controls,
    children,
  } = $props()
</script>

<!-- Transparent backdrop to close panel on outside click -->
{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
{/if}

<aside
  class="p-panel side-panel"
  class:open
  style="--panel-width: {width}"
  aria-label={title}
  aria-hidden={!open}
  inert={!open}
>
  <div class="p-panel__header">
    <h2 class="p-panel__title">{title}</h2>
    <div class="p-panel__controls">
      {@render controls?.()}
      <button
        class="p-button--base is-dense has-icon"
        onclick={onClose}
        aria-label="Close {title}"
      ><i class="p-icon--close"></i></button>
    </div>
  </div>

  <div class="p-panel__content panel-body">
    {@render children?.()}
  </div>
</aside>

<style>
  /* Backdrop catches outside clicks without dimming the dashboard */
  .backdrop {
    background: transparent;
    inset: 0;
    position: fixed;
    z-index: 199;
  }

  .side-panel {
    border-left: 1px solid var(--vf-color-border-default);
    bottom: 0;
    box-shadow: -4px 0 24px var(--mc-shadow);
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: fixed;
    right: 0;
    top: 0;
    transform: translateX(100%);
    transition: transform 0.25s ease;
    width: var(--panel-width);
    z-index: 200;
  }

  .side-panel.open {
    transform: translateX(0);
  }

  .p-panel__header {
    align-items: center;
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    flex-shrink: 0;
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .p-panel__controls {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    padding-top: 0;
  }

  .p-panel__controls :global(button) {
    margin: 0;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }
</style>
