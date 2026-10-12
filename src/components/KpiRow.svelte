<script>
  import KpiCard from './KpiCard.svelte'
  import { pctColor, fmtDate } from '../lib/utils.js'

  /** @type {{ kpis: import('../lib/processor.js').Kpis, deltas?: object|null, onBugsClick?: (() => void)|null, onTestsClick?: (() => void)|null }} */
  let { kpis, deltas = null, onBugsClick = null, onTestsClick = null } = $props()

  const today = fmtDate(new Date())
</script>

<div class="kpi-row">
  <KpiCard
    label="Builds Today"
    value={kpis.buildsToday}
    sub="artifacts built on {today}"
    pct={null}
    tone="information"
    delta={deltas?.builds ?? 0}
  />
  <KpiCard
    label="Approved"
    value="{kpis.approved.count}/{kpis.approved.total}"
    sub="{kpis.approved.pct !== null ? kpis.approved.pct + '% ' : ''}approved"
    pct={kpis.approved.pct}
    tone={pctColor(kpis.approved.pct)}
    delta={deltas?.approved ?? 0}
  />
  <KpiCard
    label="Test Executions"
    value={kpis.tests.total}
    sub="{kpis.tests.passed} pass · {kpis.tests.failed} fail"
    pct={kpis.tests.total > 0 ? Math.round(kpis.tests.passed / kpis.tests.total * 100) : null}
    tone="information"
    delta={deltas?.tests ?? 0}
    onclick={kpis.tests.total > 0 ? onTestsClick : null}
  />
  <KpiCard
    label="Pass Rate"
    value={kpis.passRate.pct !== null ? kpis.passRate.pct + '%' : '—'}
    sub="passed / (passed + failed)"
    pct={kpis.passRate.pct}
    tone={pctColor(kpis.passRate.pct)}
    delta={deltas?.passed ?? 0}
  />
  <KpiCard
    label="Open Bugs"
    value={kpis.bugs}
    sub={kpis.bugs === 0 ? 'No LP bugs referenced' : `LP bug${kpis.bugs !== 1 ? 's' : ''} in test comments`}
    pct={kpis.bugs === 0 ? 100 : null}
    tone={kpis.bugs === 0 ? 'positive' : kpis.bugs <= 3 ? 'caution' : 'negative'}
    delta={deltas?.bugs ?? 0}
    onclick={kpis.bugs > 0 ? onBugsClick : null}
  />
</div>

<style>
  .kpi-row {
    background: var(--vf-color-background-default);
    border-bottom: 1px solid var(--vf-color-border-low-contrast);
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(5, 1fr);
  }

  /* Remove right border from last card */
  .kpi-row :global(.kpi:last-child) {
    border-right: none;
  }
</style>
