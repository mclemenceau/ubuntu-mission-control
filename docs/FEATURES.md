# Feature Guide

Detailed feature reference for Ubuntu Mission Control.

## Dashboard Overview

![Ubuntu Mission Control dashboard overview](screenshots/overview-dashboard.png)

## Feature Details

- **KPI summary row** - Live aggregate counts of approved, failed, in-progress, and untested artifacts across the dashboard.

  ![KPI summary row](screenshots/kpi-summary-row.png)

- **Product grid** - Current list of built artifacts grouped in swimlanes by build date for quick freshness visibility.

  ![Product grid swimlanes](screenshots/product-grid-swimlanes.png)

- **Product card status** - Each card shows product name, architecture, flavor logo, and test status. Cards are green when approved and red when rejected for the current release.

  ![Product card status](screenshots/product-card-status.png)

- **Product detail modal** - Clicking a card opens detailed build and test information.

  ![Product detail modal](screenshots/product-detail-modal.png)

- **Product 30-day history** - The SHOW 30 DAYS HISTORY tab displays 30-day testing and build success metrics.

  ![Product 30 days history panel](screenshots/product-history-30-days.png)

- **Release selector** - Switch between tracked Ubuntu releases. Automatically renders as a dropdown when multiple releases are configured.

  ![Release selector](screenshots/release-selector.png)

- **Auto-refresh control** - Configurable polling interval with a live countdown timer and manual refresh action.

  ![Auto refresh control](screenshots/auto-refresh-control.png)

- **Respin All Images** - Requests a respin of every image in the selected release through Test Observer. The button opens Test Observer's respin page, where you sign in with Ubuntu One, review the images and confirm. Test Observer checks permissions (admins, or teams with rerun rights) and queues the requests; cdimage picks them up every 5 minutes. Mission Control never handles credentials. While a respin waits in the queue, its card shows **⟳ queued** and the header an "N queued" count.

  ![Respin All Images button and queued respins](screenshots/respin-all-images.png)

  ![Respin confirmation dialog](screenshots/respin-dialog.png)

- **Three-phase progressive loading** - Artifact cards render first, then test execution chips, then detailed test result and bug reference counts.

- **Launchpad bug extraction** - Launchpad bug numbers are parsed from structured issues and freeform test result comments.

- **Incremental state diffing** - Background refresh updates only changed cards to reduce full-page flicker.

## Related Documentation

- [Project README](../README.md)
- [Architecture and Design](../DESIGN.md)
- [Test Observer API Notes](../TEST_OBSERVER_API.md)
