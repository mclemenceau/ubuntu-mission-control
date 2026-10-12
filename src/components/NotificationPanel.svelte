<script>
  import { fmtNotifAge } from '../lib/notifications.js'
  import SidePanel from './SidePanel.svelte'

  let {
    open          = false,
    notifications = [],
    onClose       = () => {},
    onClearAll    = () => {},
    onDismiss     = () => {},
    onNotifClick  = () => {},
  } = $props()

  const TYPE_ICONS = {
    'build':     'p-icon--image',
    'approved':  'p-icon--success',
    'failed':    'p-icon--error',
    'status':    'p-icon--status',
    'test-pass': 'p-icon--success',
    'test-fail': 'p-icon--warning',
    'bug':       'p-icon--submit-bug',
  }
</script>

<SidePanel {open} title="Notifications" {onClose}>
  {#snippet controls()}
    {#if notifications.length > 0}
      <button class="p-button is-dense" onclick={onClearAll}>Clear all</button>
    {/if}
  {/snippet}

  {#if notifications.length === 0}
    <p class="u-text--muted empty">
      No notifications yet.<br />
      Changes detected during data refresh will appear here.
    </p>
  {:else}
    {#each notifications as n (n.id)}
      <div class="notif" class:unread={!n.read}>
        <button
          class="notif-main"
          onclick={() => onNotifClick(n.productId)}
          aria-label="Open {n.title}"
        >
          <i class={TYPE_ICONS[n.type] ?? 'p-icon--information'}></i>
          <span class="notif-body">
            <strong class="notif-title">{n.title}</strong>
            <span class="notif-detail u-text--muted">{n.detail}</span>
          </span>
        </button>
        <div class="notif-right">
          <span class="notif-age u-text--muted">
            {fmtNotifAge(n.timestamp)}
          </span>
          <button
            class="p-button--base is-dense has-icon dismiss-btn"
            onclick={() => onDismiss(n.id)}
            aria-label="Dismiss notification"
          ><i class="p-icon--close"></i></button>
        </div>
      </div>
    {/each}
  {/if}
</SidePanel>

<style>
  .empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  /* ── Notification item ── */
  .notif {
    align-items: flex-start;
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: flex;
  }
  .notif:hover { background: var(--vf-color-background-hover); }
  .notif.unread { background: var(--vf-color-background-alt); }

  .notif-main {
    align-items: flex-start;
    background: none;
    border: none;
    border-radius: 0;
    color: inherit;
    display: flex;
    flex: 1;
    gap: 0.75rem;
    margin: 0;
    min-width: 0;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
    text-align: left;
  }

  .notif-main > i {
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .notif-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .notif-title {
    font-size: 0.875rem;
    font-weight: 550;
  }

  .notif-detail {
    font-size: 0.875rem;
    white-space: normal;
    word-break: break-word;
  }

  /* Age + dismiss */
  .notif-right {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.25rem;
    padding: 0.75rem 1rem 0.75rem 0;
  }

  .notif-age {
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .dismiss-btn {
    margin: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .notif:hover .dismiss-btn,
  .notif:focus-within .dismiss-btn { opacity: 1; }
</style>
