<script>
  import { onMount } from 'svelte'
  import { fetchBuilds, fetchTestResults } from '../api/client.js'

  /** @type {{ product: import('../lib/processor.js').Product, onclose: () => void }} */
  let { product, onclose } = $props()

  let builds  = $state([])
  let loading = $state(true)
  let error   = $state(null)

  const FLAVOR_ICONS = {
    edubuntu:         'https://assets.ubuntu.com/v1/a2f090ef-edubuntu-logo.svg',
    kubuntu:          'https://assets.ubuntu.com/v1/d92401b4-kubuntu-logo.svg',
    lubuntu:          'https://assets.ubuntu.com/v1/6ac4ba34-lubuntu-logo.svg',
    'ubuntu-budgie':  'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    budgie:           'https://assets.ubuntu.com/v1/9b5f100b-ubuntu-budgie-logo-updated.svg',
    'ubuntu-cinnamon':'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    cinnamon:         'https://assets.ubuntu.com/v1/504cc54e-ubuntu-cinnamon-logo.svg',
    'ubuntu-kylin':   'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    kylin:            'https://assets.ubuntu.com/v1/a9914e3f-ubuntu-kylin.svg',
    'ubuntu-mate':    'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    mate:             'https://assets.ubuntu.com/v1/b89d0c93-mate.svg',
    'ubuntu-studio':  'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    studio:           'https://assets.ubuntu.com/v1/4a512076-ubuntustudio.svg',
    'ubuntu-unity':   'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    unity:            'https://assets.ubuntu.com/v1/219d06b0-ubuntu-unity-logo.png',
    xubuntu:          'https://assets.ubuntu.com/v1/36e8f12b-Xubuntu_logo.svg',
  }

  let flavorIcon = $derived.by(() => {
    const n = ((product.name ?? '') + ' ' + (product.displayName ?? '')).toLowerCase()
    for (const [key, url] of Object.entries(FLAVOR_ICONS)) {
      if (n.includes(key)) return url
    }
    return 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png'
  })

  const STATUS_LABELS = {
    APPROVED:         '✓ Approved',
    MARKED_AS_FAILED: '✗ Failed',
    UNDECIDED:        '? Undecided',
  }

  let cardClass = $derived(
    product.status === 'APPROVED'           ? 'approved'
    : product.status === 'MARKED_AS_FAILED' ? 'failed'
    : (product.ageDays ?? 99) > 7          ? 'stale'
    : 'age'
  )

  function ageVars(ageDays) {
    if (ageDays === null || ageDays > 7) {
      return '--age-border:#2a2a2a; --age-bg:#0c0c10; --age-badge:transparent; --age-text:#555'
    }
    const t = ageDays / 7
    const h = Math.round(140 - t * 110)
    return [
      `--age-border: hsl(${h},85%,${Math.round(60 - t * 20)}%)`,
      `--age-bg:     hsl(${h},70%,${Math.round(18 - t * 10)}%)`,
      `--age-badge:  hsl(${h},60%,${Math.round(22 - t * 12)}%)`,
      `--age-text:   hsl(${h},85%,${Math.round(78 - t * 18)}%)`,
    ].join('; ')
  }

  let cardStyle = $derived(ageVars(product.ageDays))

  onMount(async () => {
    try {
      const rawBuilds = await fetchBuilds(product.id)
      builds = await Promise.all(rawBuilds.map(async b => ({
        ...b,
        test_executions: await Promise.all(
          (b.test_executions ?? []).map(async te => ({
            ...te,
            results: await fetchTestResults(te.id).catch(() => []),
          }))
        ),
      })))
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onclose()
  }

  function onKeydown(e) {
    if (e.key === 'Escape') onclose()
  }

  function execStatusClass(status) {
    if (!status) return ''
    if (status === 'PASSED')                                   return 'exec-passed'
    if (['FAILED', 'ENDED_PREMATURELY'].includes(status))     return 'exec-failed'
    if (status === 'IN_PROGRESS')                              return 'exec-progress'
    return 'exec-pending'
  }

  function resultStatusClass(status) {
    if (status === 'PASSED') return 'res-pass'
    if (status === 'FAILED') return 'res-fail'
    return 'res-other'
  }

  /** "patriciasd - PowerVM - POWER10 Virtual Media" → { tester: "patriciasd", testName: "PowerVM - POWER10 Virtual Media" } */
  function parseResultName(name) {
    if (!name) return { tester: null, testName: '—' }
    const idx = name.indexOf(' - ')
    if (idx === -1) return { tester: null, testName: name }
    return { tester: name.slice(0, idx), testName: name.slice(idx + 3) }
  }

  /** Collect unique testers from an execution's results. */
  function execTesters(results) {
    return [...new Set(results.map(r => parseResultName(r.name).tester).filter(Boolean))]
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="backdrop" onclick={onBackdropClick} role="presentation">
  <div class="modal" style={cardStyle} role="dialog" aria-modal="true">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="modal-header {cardClass}">
      <div class="header-left">
        <img class="header-flavor-icon" src={flavorIcon} alt="" aria-hidden="true" />
        <div class="header-left-text">
          <div class="modal-name">
            {#if product.displayName}<span class="os-tag">{product.displayName}</span>{/if}
            <span title={product.name}>{product.name}</span>
            <a class="ext-link"
               href="https://tests.ubuntu.com/#/images/{product.id}"
               target="_blank"
               rel="noopener noreferrer"
               title="Open on tests.ubuntu.com">↗</a>
          </div>
          <div class="modal-sub">
            {product.type}{product.arch ? ` · ${product.arch}` : ''}
            {#if product.mandatory}<span class="mandatory-tag">★ mandatory</span>{/if}
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="hbadge {cardClass}">{STATUS_LABELS[product.status] ?? '—'}</span>
        {#if product.ageDays !== null}
          <span class="age-chip" style="color:var(--age-text)">
            {product.ageDays === 0 ? 'built today' : `${product.ageDays}d old`}
          </span>
        {/if}
        <button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
      </div>
    </div>

    <!-- ── Artifact details strip ─────────────────────────────── -->
    <div class="details-strip">
      <div class="detail-item">
        <span class="dl">Version</span>
        <span class="dv mono">{product.version ?? '—'}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Architecture</span>
        <span class="dv">{product.arch || '—'}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Type</span>
        <span class="dv">{product.type || '—'}</span>
      </div>
      <div class="detail-item">
        <span class="dl">Tests</span>
        <span class="dv">
          {#if product.tests.passed > 0}<span class="chip-pass">✓ {product.tests.passed}</span>{/if}
          {#if product.tests.failed > 0}<span class="chip-fail">✗ {product.tests.failed}</span>{/if}
          {#if product.tests.inProgress > 0}<span class="chip-prog">… {product.tests.inProgress}</span>{/if}
          {#if product.tests.notStarted > 0}<span class="chip-skip">○ {product.tests.notStarted}</span>{/if}
          {#if product.tests.passed + product.tests.failed + product.tests.inProgress + product.tests.notStarted === 0}
            <span class="dim">none</span>
          {/if}
        </span>
      </div>
      {#if product.bugs.length > 0}
        <div class="detail-item full">
          <span class="dl">Bugs</span>
          <span class="dv">
            {#each product.bugs as bug}
              <span class="bug-tag">LP#{bug}</span>
            {/each}
          </span>
        </div>
      {/if}
    </div>

    <!-- ── Build / test-run body ──────────────────────────────── -->
    <div class="modal-body">
      {#if loading}
        <div class="state-msg">Loading build details…</div>
      {:else if error}
        <div class="state-msg err">Error: {error}</div>
      {:else if builds.length === 0}
        <div class="state-msg">No builds found for this artifact.</div>
      {:else}
        {#each builds as build, bi}
          <div class="build-block">
            <div class="build-title">
              Build {bi + 1}
              {#if build.architecture} · <span class="mono">{build.architecture}</span>{/if}
              {#if build.revision}     · <span class="mono dim">{build.revision}</span>{/if}
              {#if build.status}       · <span class="build-status">{build.status}</span>{/if}
            </div>

            {#if (build.test_executions ?? []).length === 0}
              <div class="no-exec">No test executions for this build.</div>
            {:else}
              {#each build.test_executions as exec}
                <div class="exec-block">
                  <div class="exec-header">
                    <div class="exec-header-left">
                      <span class="exec-plan">{exec.test_plan ?? 'Test execution'}</span>
                      {#if exec.environment?.name}
                        <span class="exec-env">{exec.environment.name}</span>
                      {/if}
                      {#each execTesters(exec.results) as tester}
                        <span class="exec-user" title="Tester">👤 {tester}</span>
                      {/each}
                      {#if exec.ci_link}
                        <a class="exec-link"
                           href={exec.ci_link.slice(0, exec.ci_link.lastIndexOf('/') + 1)}
                           target="_blank"
                           rel="noopener noreferrer"
                           title="Open artifact folder">↗ folder</a>
                      {/if}
                      {#each exec.relevant_links ?? [] as link}
                        <a class="exec-link" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                      {/each}
                    </div>
                    <span class="exec-badge {execStatusClass(exec.status)}">{exec.status ?? '—'}</span>
                  </div>

                  {#if exec.results.length === 0}
                    <div class="no-results">No test results submitted yet.</div>
                  {:else}
                    <table class="results-table">
                      <thead>
                        <tr>
                          <th>Tester</th>
                          <th>Test</th>
                          <th>Status</th>
                          <th>Comment / Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each exec.results as r}
                          {@const { tester, testName } = parseResultName(r.name)}
                          <tr class={resultStatusClass(r.status)}>
                            <td class="result-tester">{tester ?? '—'}</td>
                            <td class="result-name">{testName}</td>
                            <td>
                              <span class="res-badge {resultStatusClass(r.status)}">{r.status ?? '—'}</span>
                            </td>
                            <td class="result-detail">
                              {#if r.comment}<span class="result-comment">{r.comment}</span>{/if}
                              {#each r.issues ?? [] as { issue }}
                                {#if issue?.key}
                                  <span class="bug-tag small">LP#{issue.key}</span>
                                {/if}
                              {/each}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/each}
      {/if}
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

  .modal {
    width: 100%;
    max-width: 1232px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    border-radius: 11px;
    border: 1px solid #2a2a2a;
    background: var(--bg-panel);
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  }

  /* ── Header ───────────────────────────────────────────────── */
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.54rem;
    padding: 1.32rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .modal-header.approved { background: var(--green-bg);  border-bottom-color: var(--green-border); }
  .modal-header.failed   { background: var(--red-bg);    border-bottom-color: var(--red-border); }
  .modal-header.age      { background: var(--age-bg);    border-bottom-color: var(--age-border); }
  .modal-header.stale    { background: #0c0c10; border-bottom-color: #252525; }

  .header-left  { display: flex; flex-direction: row; align-items: center; gap: 0.88rem; min-width: 0; }

  .header-flavor-icon {
    width: 42px;
    height: 42px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .header-left-text { display: flex; flex-direction: column; gap: 0.31rem; min-width: 0; }
  .header-right { display: flex; align-items: center; gap: 0.77rem; flex-shrink: 0; }

  .modal-name {
    font-size: 1.41rem;
    font-weight: 700;
    color: #ddd;
    display: flex;
    align-items: center;
    gap: 0.62rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .ext-link {
    font-size: 1.06rem;
    font-weight: 400;
    color: var(--accent);
    text-decoration: none;
    opacity: 0.7;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }
  .ext-link:hover { opacity: 1; }

  .os-tag {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
    background: rgba(255,255,255,0.07);
    padding: 0.15em 0.5em;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .modal-sub {
    font-size: 1.06rem;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 0.62rem;
  }

  .mandatory-tag {
    color: var(--accent);
    font-size: 1rem;
    font-weight: 700;
  }

  .hbadge {
    display: inline-block;
    padding: 0.15em 0.55em;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: #222;
    color: var(--text-dim);
  }
  .hbadge.approved { background: var(--green-border); color: #5ddb5d; }
  .hbadge.failed   { background: var(--red-border);   color: var(--red); }
  .hbadge.age      { background: var(--age-badge);    color: var(--age-text); }
  .hbadge.stale    { background: transparent; color: #666; }

  .age-chip {
    font-size: 1rem;
    font-family: monospace;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 1.32rem;
    cursor: pointer;
    padding: 0.22rem 0.44rem;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }
  .close-btn:hover { color: #ddd; background: rgba(255,255,255,0.08); }

  /* ── Details strip ────────────────────────────────────────── */
  .details-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.77rem 2.2rem;
    padding: 0.97rem 1.54rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
  }

  .detail-item {
    display: flex;
    align-items: baseline;
    gap: 0.53rem;
  }
  .detail-item.full { flex-basis: 100%; }

  .dl {
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .dv {
    font-size: 1.06rem;
    color: #ccc;
    display: flex;
    align-items: center;
    gap: 0.39rem;
    flex-wrap: wrap;
  }

  /* ── Body ─────────────────────────────────────────────────── */
  .modal-body {
    overflow-y: auto;
    flex: 1;
    padding: 1.14rem 1.54rem;
    display: flex;
    flex-direction: column;
    gap: 1.14rem;
  }

  .state-msg {
    font-size: 1.23rem;
    color: var(--text-dim);
    padding: 1.54rem 0;
    text-align: center;
  }
  .state-msg.err { color: var(--red); }

  /* ── Build block ──────────────────────────────────────────── */
  .build-block {
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    overflow: hidden;
  }

  .build-title {
    font-size: 1.06rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0.62rem 1.14rem;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .build-status { color: var(--accent); }

  .no-exec, .no-results {
    font-size: 1.06rem;
    color: #555;
    font-style: italic;
    padding: 0.77rem 1.14rem;
  }

  /* ── Exec block ───────────────────────────────────────────── */
  .exec-block {
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .exec-block:first-child { border-top: none; }

  .exec-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.77rem;
    padding: 0.7rem 1.14rem;
    background: rgba(0,0,0,0.15);
  }

  .exec-header-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.62rem;
    flex: 1;
    min-width: 0;
  }

  .exec-plan {
    font-size: 1.06rem;
    font-weight: 600;
    color: #bbb;
  }

  .exec-env {
    font-size: 1rem;
    color: #666;
    font-style: italic;
  }

  .exec-user {
    font-size: 1rem;
    color: #aaa;
    background: rgba(255,255,255,0.05);
    padding: 0.05em 0.35em;
    border-radius: 2px;
  }

  .exec-link {
    font-size: 0.97rem;
    color: var(--accent);
    text-decoration: none;
    opacity: 0.75;
    transition: opacity 0.15s;
  }
  .exec-link:hover { opacity: 1; }

  .exec-badge {
    font-size: 0.88rem;
    font-weight: 700;
    padding: 0.1em 0.45em;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .exec-passed  { background: #1a4d1a; color: #5ddb5d; }
  .exec-failed  { background: #4d1a1a; color: var(--red); }
  .exec-progress{ background: #1a2d4d; color: var(--blue); }
  .exec-pending { background: #2a2a2a; color: #666; }

  /* ── Results table ────────────────────────────────────────── */
  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 1.06rem;
  }

  .results-table thead tr {
    background: rgba(0,0,0,0.2);
  }
  .results-table th {
    text-align: left;
    padding: 0.44rem 1.14rem;
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #555;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .results-table td {
    padding: 0.44rem 1.14rem;
    vertical-align: top;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    color: #bbb;
  }
  .results-table tr:last-child td { border-bottom: none; }

  .res-pass td { background: rgba(0,60,0,0.15); }
  .res-fail td { background: rgba(60,0,0,0.15); }

  .res-badge {
    font-size: 0.88rem;
    font-weight: 700;
    padding: 0.1em 0.4em;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .res-badge.res-pass { background: #1a4d1a; color: #5ddb5d; }
  .res-badge.res-fail { background: #4d1a1a; color: var(--red); }
  .res-badge.res-other { background: #2a2a2a; color: #666; }

  .result-tester { color: #aaa; white-space: nowrap; font-size: 1rem; }
  .result-name   { color: #ccc; }
  .result-detail { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 0.44rem; }
  .result-comment { color: #999; font-style: italic; }

  /* ── Shared chips / tags ──────────────────────────────────── */
  .chip-pass { background: #1a4d1a; color: #5ddb5d; padding: 0.1em 0.35em; border-radius: 2px; font-size: 1rem; font-weight: 700; }
  .chip-fail { background: #4d1a1a; color: var(--red);   padding: 0.1em 0.35em; border-radius: 2px; font-size: 1rem; font-weight: 700; }
  .chip-prog { background: #1a2d4d; color: var(--blue);  padding: 0.1em 0.35em; border-radius: 2px; font-size: 1rem; font-weight: 700; }
  .chip-skip { background: #2a2a2a; color: var(--text-muted); padding: 0.1em 0.35em; border-radius: 2px; font-size: 1rem; font-weight: 700; }

  .bug-tag {
    background: #2d1a00;
    color: #cc7700;
    border: 1px solid #5a3500;
    padding: 0.1em 0.4em;
    border-radius: 4px;
    font-size: 1rem;
    font-family: monospace;
  }
  .bug-tag.small { font-size: 0.88rem; }

  .mono  { font-family: monospace; }
  .dim   { color: #555; }
</style>
