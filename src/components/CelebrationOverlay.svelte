<script>
  let { onDismiss } = $props()

  // Generate confetti particles once on mount
  const COLORS = [
    '#e95420', '#77216f', '#2c001e', '#aea79f',
    '#f5c518', '#5ba85a', '#3584e4', '#e01b24',
    '#ff7800', '#33d17a', '#62a0ea', '#f6d32d',
    '#ffffff', '#c061cb', '#ed333b', '#57e389',
  ]

  const particles = Array.from({ length: 90 }, (_, i) => ({
    id: i,
    left:     Math.random() * 100,
    delay:    Math.random() * 4,
    duration: 2.5 + Math.random() * 3,
    color:    COLORS[Math.floor(Math.random() * COLORS.length)],
    size:     6 + Math.random() * 10,
    rotate:   Math.random() * 360,
    drift:    (Math.random() - 0.5) * 120,
    isCircle: Math.random() > 0.5,
  }))

  function handleKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDismiss()
  }
</script>

<svelte:window onkeydown={handleKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={onDismiss} role="dialog" aria-modal="true" aria-label="All artifacts approved celebration" tabindex="-1">
  <div class="confetti-layer" aria-hidden="true">
    {#each particles as p (p.id)}
      <div
        class="particle {p.isCircle ? 'circle' : 'square'}"
        style="
          left:{p.left}%;
          width:{p.size}px;
          height:{p.size}px;
          background:{p.color};
          animation-delay:{p.delay}s;
          animation-duration:{p.duration}s;
          --drift:{p.drift}px;
          --rot:{p.rotate}deg;
        "
      ></div>
    {/each}
  </div>

  <div class="center-stage" aria-live="assertive">
    <div class="burst-ring"></div>
    <div class="burst-ring ring2"></div>
    <div class="headline">
      <span class="check">✓</span>
      ALL APPROVED
      <span class="check">✓</span>
    </div>
    <div class="sub">Release is ready to ship!</div>
    <button class="dismiss-btn" onclick={onDismiss}>
      Awesome! &nbsp;✕
    </button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Confetti ── */
  .confetti-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    top: -16px;
    border-radius: 2px;
    animation: fall linear infinite;
  }

  .particle.circle {
    border-radius: 50%;
  }

  @keyframes fall {
    0% {
      transform: translateY(0) translateX(0) rotate(var(--rot));
      opacity: 1;
    }
    80% { opacity: 1; }
    100% {
      transform: translateY(110vh) translateX(var(--drift)) rotate(calc(var(--rot) + 540deg));
      opacity: 0;
    }
  }

  /* ── Center stage ── */
  .center-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    pointer-events: auto;
    animation: pop-in 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    text-align: center;
  }

  @keyframes pop-in {
    0%   { transform: scale(0.3); opacity: 0; }
    70%  { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }

  .burst-ring {
    position: absolute;
    inset: -3rem;
    border-radius: 50%;
    border: 3px solid rgba(233, 84, 32, 0.6);
    animation: ring-pulse 2s ease-out infinite;
    pointer-events: none;
  }

  .ring2 {
    inset: -5rem;
    border-color: rgba(91, 168, 90, 0.4);
    animation-delay: 0.7s;
  }

  @keyframes ring-pulse {
    0%   { transform: scale(0.8); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  .headline {
    font-size: clamp(2.4rem, 6vw, 5rem);
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    text-shadow:
      0 0 30px rgba(233, 84, 32, 0.9),
      0 0 60px rgba(233, 84, 32, 0.5),
      0 4px 12px rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    gap: 0.6em;
    animation: shimmer 2.5s ease-in-out infinite alternate;
  }

  @keyframes shimmer {
    from { filter: brightness(1); }
    to   { filter: brightness(1.35) drop-shadow(0 0 20px #e95420); }
  }

  .check {
    color: #33d17a;
    font-size: 0.85em;
    text-shadow:
      0 0 20px rgba(51, 209, 122, 0.9),
      0 0 40px rgba(51, 209, 122, 0.5);
    animation: check-bounce 0.6s ease-in-out infinite alternate;
  }

  @keyframes check-bounce {
    from { transform: translateY(0); }
    to   { transform: translateY(-6px); }
  }

  .sub {
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.04em;
    text-shadow: 0 2px 8px rgba(0,0,0,0.6);
  }

  .dismiss-btn {
    margin-top: 0.5rem;
    padding: 0.6rem 2rem;
    background: rgba(233, 84, 32, 0.85);
    border: 2px solid rgba(233, 84, 32, 1);
    border-radius: 6px;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }

  .dismiss-btn:hover {
    background: rgba(233, 84, 32, 1);
    transform: translateY(-2px);
  }

  .dismiss-btn:active {
    transform: translateY(0);
  }
</style>
