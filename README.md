# Ubuntu Mission Control

Real-time dashboard for Ubuntu image release tracking.

During the Ubuntu 26.04 development cycle, the Ubuntu Release Team moved image and test tracking to tests.ubuntu.com. This infrastructure uses Test Observer tooling (canonical/test_observer) and offers a public API.

Ubuntu Mission Control is an experiment that provides advanced visibility into the Ubuntu release process by leveraging the tests.ubuntu.com API.

It provides detailed build information and release-critical KPIs, including:
- Current artifact status (approved/failed/undecided)
- Build freshness (today vs stale)
- Manual testing progress and pass rate
- Launchpad bugs referenced in test results

## Overview
![Ubuntu Mission Control dashboard overview](docs/screenshots/overview-dashboard.png)

## Features

Ubuntu Mission Control provides:
- Release KPIs at a glance (approved, failed, in-progress, untested)
- Artifact freshness and build visibility in swimlanes
- Product-level build and test detail views
- Historical trends and testing outcomes over the last 30 days
- Release-aware filtering, auto-refresh, and incremental updates
- Launchpad bug extraction from test results

For full feature details and screenshots, see [Feature Guide](docs/FEATURES.md).

## Documentation

- [Feature Guide](docs/FEATURES.md)
- [Architecture and Design](DESIGN.md)
- [Test Observer API Notes](TEST_OBSERVER_API.md)

## Quick Start

```bash
make install
make dev
```

The app runs on http://localhost:3000 by default.

## Commands

```bash
make dev      # start Vite dev server
make test     # run unit tests
make build    # production build to dist/
make serve    # preview production build
```
