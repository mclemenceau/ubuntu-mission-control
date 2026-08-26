<script>
  import KpiCard from './KpiCard.svelte'
  import { pctColor, fmtDate } from '../lib/utils.js'

  /** @type {{ kpis: import('../lib/processor.js').Kpis, deltas?: object|null, onBugsClick?: (() => void)|null }} */
  let { kpis, deltas = null, onBugsClick = null } = $props()

  const today = fmtDate(new Date())
</script>

<div class="kpi-row">
  <KpiCard
    label="Builds Today"
    value={kpis.buildsToday}
    sub="artifacts built on {today}"
    pct={null}
    color="blue"
    delta={deltas?.builds ?? 0}
  />
  <KpiCard
    label="Approved"
    value="{kpis.approved.count}/{kpis.approved.total}"
    sub="{kpis.approved.pct !== null ? kpis.approved.pct + '% ' : ''}approved"
    pct={kpis.approved.pct}
    color={pctColor(kpis.approved.pct)}
    delta={deltas?.approved ?? 0}
  />
  <KpiCard
    label="Test Executions"
    value={kpis.tests.total}
    sub="{kpis.tests.passed} pass · {kpis.tests.failed} fail · {kpis.tests.inProgress} in progress"
    pct={kpis.tests.total > 0 ? Math.round(kpis.tests.passed / kpis.tests.total * 100) : null}
    color="blue"
    delta={deltas?.tests ?? 0}
  />
  <KpiCard
    label="Pass Rate"
    value={kpis.passRate.pct !== null ? kpis.passRate.pct + '%' : '—'}
    sub="passed / (passed + failed)"
    pct={kpis.passRate.pct}
    color={pctColor(kpis.passRate.pct)}
    delta={deltas?.passed ?? 0}
  />
  <KpiCard
    label="Open Bugs"
    value={kpis.bugs}
    sub={kpis.bugs === 0 ? 'No LP bugs referenced' : `LP bug${kpis.bugs !== 1 ? 's' : ''} in test comments`}
    pct={kpis.bugs === 0 ? 100 : null}
    color={kpis.bugs === 0 ? 'green' : kpis.bugs <= 3 ? 'amber' : 'red'}
    delta={deltas?.bugs ?? 0}
    onclick={kpis.bugs > 0 ? onBugsClick : null}
  />
</div>

<style>
  .kpi-row {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
  }

  /* Remove right border from last card */
  .kpi-row :global(.kpi:last-child) {
    border-right: none;
  }
</style>
