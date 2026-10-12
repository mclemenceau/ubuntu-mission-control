# Release Mission Control — Design Notes

## What this is

A real-time dashboard for Ubuntu release tracking. It shows the status of all image artifacts for a given release: which were built today, which have been reviewed, and how testing is progressing.

Data source: [Test Observer API](https://tests-api.ubuntu.com) (`/v1/artefacts`, `/v1/artefacts/{id}/builds`, `/v1/test-executions/{id}/test-results`).

---

## Running locally

```bash
make install   # once — installs node_modules
make dev       # daily — Vite dev server at http://localhost:3000
make build     # production bundle → dist/
make serve     # build + preview production bundle
```

`make dev` uses Vite's built-in proxy to forward `/api/*` requests to `https://tests-api.ubuntu.com`. No separate proxy process needed.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Svelte 5 (runes: `$state`, `$derived`, `$props`) |
| Build tool | Vite 6 |
| Styling | [Vanilla Framework](https://vanillaframework.io) (SCSS) + scoped Svelte styles using Vanilla's `--vf-color-*` tokens |
| Data | Vanilla `fetch` — no HTTP client library |

---

## Source layout

```
src/
  api/
    client.js          — all API calls (fetchArtefacts, fetchBuilds, fetchTestResults)
  lib/
    milestones.js      — release config, deriveArtifact(), buildMandatorySet(), releases[]
    processor.js       — data pipeline: build items → enrich executions → enrich bugs/results
    utils.js           — date helpers, color logic, formatting
  components/
    Header.svelte      - Vanilla navigation, page links, release selector, clock
    SidePanel.svelte   - shared slide-in panel (Vanilla p-panel)
    RefreshControl.svelte — auto-refresh toggle + interval + countdown + manual button
    KpiCard.svelte / KpiRow.svelte
    ProductCard.svelte / ProductGrid.svelte
  App.svelte           — root: state, load pipeline, timers
  styles/main.scss     - Vanilla imports (only the patterns used), app tokens
milestones.json        — release/build configuration
```

---

## Data pipeline

Loading happens in three phases so the UI can render progressively:

```
Phase 1 — Artifacts
  fetchArtefacts()
  → filter by release codename
  → add builtToday flag (version starts with YYYYMMDD)
  → render cards immediately (status colors, no test data)

Phase 2 — Test executions
  fetchBuilds(id) for each artifact  [parallel]
  → filter to test_plan === 'Manual Testing'
  → count execution-level status: passed / failed / inProgress / notStarted
  → update cards with test chips

Phase 3 — Individual test results + bugs
  fetchTestResults(execId) for each unique execution  [parallel, deduplicated]
  → count individual result statuses (PASSED / FAILED)
  → overwrite Phase 2 counts — execution status stays IN_PROGRESS even after
    results are submitted, so individual results are the source of truth
  → extract LP bug references from comments (structured issues + freeform patterns)
  → update cards and KPIs
```

**Background refresh** fetches fresh data through the same pipeline, then calls `diffProducts()` to merge it into the current state — only cards whose status/tests/bugs actually changed are re-rendered.

---

## Theming

The app uses Vanilla's theme classes on `<html>`: `is-light` (default) or
`is-dark`, toggled from the header and remembered in `localStorage`. Use
Vanilla tokens (`--vf-color-text-default`, `--vf-color-background-*`, ...)
for UI chrome, and the app tokens `--mc-positive`, `--mc-negative`,
`--mc-caution`, `--mc-information` for data marks so they adapt per theme.
Prefer Vanilla patterns (`p-button`, `p-chip`, `p-status-label`,
`p-segmented-control`, `p-modal`, ...) over custom components.

---

## Card coloring

| Built today | Status | Card |
|---|---|---|
| ✓ | APPROVED | green |
| ✓ | MARKED_AS_FAILED | red |
| ✓ | UNDECIDED / null | amber |
| ✗ | APPROVED | green |
| ✗ | MARKED_AS_FAILED | red |
| ✗ | UNDECIDED / null | grey (stale) |

---

## Release configuration (`milestones.json`)

```jsonc
{
  "milestones": [
    {
      "release": "resolute",   // matches API artifact.release field
      "name": "Beta",          // milestone event label (not shown in mission control)
      "date": "2026-03-25",
      "builds": [
        { "project": "ubuntu", "arch": "amd64", "type": "desktop",
          "version": "20260325", "path": "daily-live", "mandatory": true }
        // ...
      ]
    }
  ]
}
```

To add a new release: add a new entry to `milestones`. The release selector becomes a dropdown automatically when more than one release is present. If two entries share the same `release` codename (e.g. Alpha then Beta), the last one wins — the `releases` export in `milestones.js` deduplicates by codename.

The `mandatory: true` flag marks critical builds with a ★ on their card.

---

## CORS / proxy

The API does not send `Access-Control-Allow-Origin`. In dev and preview (`make dev` / `make serve`), Vite's proxy handles this transparently. The built app always uses `/api/v1/...` URLs.

For a public deployment without a Node server (e.g. GitHub Pages), a Cloudflare Worker or Netlify/Vercel serverless function would be needed as a proxy.
