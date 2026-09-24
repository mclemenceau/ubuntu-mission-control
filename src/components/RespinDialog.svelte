<script>
  import { respinPageUrl } from '../lib/respin.js'

  let { release, imageCount, onclose } = $props()

  let releaseName = $derived(release.charAt(0).toUpperCase() + release.slice(1))

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onclose()
  }

  function onKeydown(e) {
    if (e.key === 'Escape') onclose()
  }

  // Mission Control can't carry the Test Observer session (different site),
  // so the respin itself is confirmed and submitted in Test Observer.
  function continueToTestObserver() {
    window.open(respinPageUrl(release), '_blank', 'noopener,noreferrer')
    onclose()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" onclick={onBackdropClick} role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="respin-title">
    <h2 id="respin-title">Respin all {imageCount} {releaseName} images?</h2>
    <p>
      You'll review the list, sign in with Ubuntu One if needed, and confirm
      in Test Observer.
    </p>
    <p class="note">
      Only accounts with respin permission (admins or teams with rerun
      rights) can submit. Cards here show <strong>⟳ queued</strong> once
      Test Observer has the request; cdimage picks requests up every 5 minutes.
    </p>
    <div class="actions">
      <button class="btn" onclick={onclose}>Cancel</button>
      <button class="btn primary" onclick={continueToTestObserver}>
        Continue to Test Observer ↗
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .dialog {
    width: 100%;
    max-width: 520px;
    padding: 1.4rem 1.6rem;
    border-radius: 11px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-panel);
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    color: var(--text);
  }

  h2 {
    margin: 0 0 0.9rem;
    font-size: 1.25rem;
    color: var(--text-bright);
  }

  p {
    margin: 0 0 0.75rem;
    line-height: 1.45;
  }

  .note {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.2rem;
  }

  .btn {
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, filter 0.15s;
  }
  .btn:hover { color: var(--text); border-color: var(--accent); }

  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:hover { filter: brightness(1.1); }
</style>
