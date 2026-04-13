<script>
  import { fmtNotifAge } from '../lib/notifications.js'

  let {
    open          = false,
    notifications = [],
    onClose       = () => {},
    onClearAll    = () => {},
    onDismiss     = () => {},
    onNotifClick  = () => {},
  } = $props()

  const TYPE_META = {
    'build':     { icon: '⬡', cls: 'blue'  },
    'approved':  { icon: '✓', cls: 'green' },
    'failed':    { icon: '✗', cls: 'red'   },
    'status':    { icon: '◎', cls: 'muted' },
    'test-pass': { icon: '✓', cls: 'green' },
    'test-fail': { icon: '✗', cls: 'amber' },
    'bug':       { icon: '▲', cls: 'amber' },
  }
</script>

<!-- Transparent backdrop to close panel on outside click -->
{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
{/if}

<aside class="panel" class:open aria-label="Notifications" aria-hidden={!open}>
  <div class="panel-header">
    <span class="panel-title">Notifications</span>
    {#if notifications.length > 0}
      <button class="clear-btn" onclick={onClearAll}>Clear all</button>
    {/if}
    <button class="close-btn" onclick={onClose} aria-label="Close notifications">✕</button>
  </div>

  <div class="panel-body">
    {#if notifications.length === 0}
      <div class="empty">
        No notifications yet.<br />
        Changes detected during data refresh will appear here.
      </div>
    {:else}
      {#each notifications as n (n.id)}
        {@const meta = TYPE_META[n.type] ?? { icon: '•', cls: 'muted' }}
        <div class="notif" class:unread={!n.read}>
          <button
            class="notif-main"
            onclick={() => onNotifClick(n.productId)}
            aria-label="Open {n.title}"
          >
            <div class="notif-icon {meta.cls}">{meta.icon}</div>
            <div class="notif-body">
              <div class="notif-title">{n.title}</div>
              <div class="notif-detail">{n.detail}</div>
            </div>
          </button>
          <div class="notif-right">
            <span class="notif-age">{fmtNotifAge(n.timestamp)}</span>
            <button
              class="dismiss-btn"
              onclick={() => onDismiss(n.id)}
              aria-label="Dismiss notification"
            >✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  /* Backdrop catches outside clicks without dimming the dashboard */
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

  .clear-btn {
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 0.78rem;
    padding: 0.2rem 0.55rem;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .clear-btn:hover {
    color: var(--text);
    border-color: var(--accent);
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
    line-height: 1.6;
  }

  /* ── Notification item ── */
  .notif {
    display: flex;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-subtle);
    transition: background 0.1s;
  }
  .notif:hover { background: var(--surface-hover); }
  .notif.unread { background: var(--surface-faint); }

  .notif-main {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    flex: 1;
    min-width: 0;
    padding: 0.65rem 0.5rem 0.65rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    border-radius: 0;
  }
  .notif-main:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  /* Icon circle */
  .notif-icon {
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
  }
  .notif-icon.green { background: var(--green-bg);  border: 1px solid var(--green-border); color: var(--green); }
  .notif-icon.red   { background: var(--red-bg);    border: 1px solid var(--red-border);   color: var(--red);   }
  .notif-icon.amber { background: var(--amber-bg);  border: 1px solid var(--amber-border); color: var(--amber); }
  .notif-icon.blue  {
    background: rgba(88, 166, 255, 0.1);
    border: 1px solid rgba(88, 166, 255, 0.3);
    color: var(--blue);
  }
  .notif-icon.muted {
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
  }

  /* Text */
  .notif-body {
    flex: 1;
    min-width: 0;
  }

  .notif-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-bright);
    margin-bottom: 0.15rem;
  }

  .notif-detail {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: normal;
    word-break: break-word;
  }

  /* Age + dismiss */
  .notif-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
    flex-shrink: 0;
    padding: 0.65rem 1rem 0.65rem 0;
  }

  .notif-age {
    font-size: 0.72rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .dismiss-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    border-radius: 2px;
    opacity: 0;
    transition: color 0.1s, opacity 0.1s;
  }
  .notif:hover .dismiss-btn, .notif-main:focus-visible ~ .notif-right .dismiss-btn { opacity: 1; }
  .dismiss-btn:hover { color: var(--red); }
</style>
