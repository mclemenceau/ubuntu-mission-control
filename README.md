# Ubuntu Mission Control

Real-time dashboard for Ubuntu release tracking.

During the Ubuntu 26.04 development cycle, the Ubuntu Release Team moved image and test tracking to tests.ubuntu.com. This infrastructure uses Test Observer tooling ([canonical/test_observer](https://github.com/canonical/test_observer)).
See [Retiring the ISO Tracker! Introducing tests.ubuntu.com](https://discourse.ubuntu.com/t/retiring-the-iso-tracker-introducing-tests-ubuntu-com-for-26-04-lts/78683) for details on the transition.

Ubuntu Mission Control is an experiment that provides advanced visibility into the Ubuntu release process by leveraging the new tests.ubuntu.com API.

Latest published dashboard: [https://mclemenceau.github.io/ubuntu-mission-control/](https://mclemenceau.github.io/ubuntu-mission-control/)

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
- [Contributing Guide](CONTRIBUTING.md)

## AI Disclosure

This project has been developed hand in hand with AI agents like [Claude](https://claude.ai/) (Anthropic) and [GitHub Copilot](https://github.com/features/copilot).

To maintain code quality and reliability, several quality gates run on every change:

- **Tests** — [Vitest](https://vitest.dev/) ensures core data pipeline and component behavior are correct
- **Type checking** — Svelte enforces component type safety within templates
- **Build verification** — Vite production builds are verified to catch bundle and dependency issues

Development continues with a focus on learning best practices for AI-assisted development while maintaining high code quality standards. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how we review and test AI-generated code.

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
