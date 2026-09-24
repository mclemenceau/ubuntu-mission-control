# Test Observer API Reference

This document describes the Test Observer REST API for the purpose of building a UI against it.

## Base URL

```
https://tests-api.ubuntu.com
```

The public frontend at `https://tests.ubuntu.com` is a Flutter web app that reads this URL from `window.testObserverAPIBaseURI` at runtime.

## Authentication

- **Read endpoints** (GET) are publicly accessible — no auth required.
- **Write endpoints** (POST/PATCH/PUT/DELETE) require a logged-in session via SAML SSO or an API key.
- All requests should include the header `X-CSRF-Token: 1`.
- Cookies carry the session (`withCredentials: true` equivalent).

### SAML login flow

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/auth/saml/login` | Redirects to SSO. Optional `?return_to=<url>` |
| POST | `/v1/auth/saml/acs` | SSO callback — sets session cookie |
| GET | `/v1/auth/saml/logout` | Initiates logout |
| GET/POST | `/v1/auth/saml/sls` | Logout callback |

---

## OpenAPI / Swagger

- **Schema**: `GET https://tests-api.ubuntu.com/openapi.json`
- **Swagger UI**: `https://tests-api.ubuntu.com/docs`
- **ReDoc UI**: `https://tests-api.ubuntu.com/redocs`

---

## Current Data

Only the `image` family has live data (116 artefacts as of 2026-04-02). Families `snap`, `deb`, `charm` return empty arrays currently.

---

## Enumerations

```
ArtefactStatus:       APPROVED | MARKED_AS_FAILED | UNDECIDED
TestExecutionStatus:  NOT_STARTED | IN_PROGRESS | PASSED | FAILED | NOT_TESTED | ENDED_PREMATURELY
TestResultStatus:     PASSED | FAILED | SKIPPED
C3TestResultStatus:   pass | fail | skip
FamilyName:           snap | deb | charm | image
StageName:            proposed | updates | edge | beta | candidate | stable | pending | current
SnapStage:            edge | beta | candidate | stable
DebStage:             proposed | updates
CharmStage:           edge | beta | candidate | stable
ImageStage:           pending | current
IssueStatus:          unknown | open | closed
IssueSource:          jira | github | launchpad
```

---

## Endpoints

### Version

```
GET /v1/version
```
Returns `{"version": "0.0.0"}`. No auth needed.

---

### Artefacts

Artefacts are software packages (snaps, debs, charms, images) under test.

#### List artefacts by family

```
GET /v1/artefacts?family=<FamilyName>
```

Returns array of `ArtefactResponse`. Example:

```json
[
  {
    "id": 11308,
    "name": "bionic-base-amd64.tar.gz",
    "version": "20260402",
    "track": "",
    "store": "",
    "branch": "",
    "series": "",
    "repo": "",
    "source": "",
    "os": "ubuntu-base",
    "release": "bionic",
    "owner": "canonical-foundations",
    "sha256": "27851af4c4449b712940d38ecf409ddb81aa00cf52046a0b8fadd9a3bbbc8d82",
    "image_url": "https://cdimage.ubuntu.com/ubuntu-base/bionic/daily/20260402/bionic-base-amd64.tar.gz",
    "stage": "pending",
    "family": "image",
    "status": "UNDECIDED",
    "comment": "",
    "archived": false,
    "assignee": null,
    "due_date": null,
    "created_at": "2026-04-02T05:06:52.039221",
    "bug_link": "",
    "all_environment_reviews_count": 2,
    "completed_environment_reviews_count": 0
  }
]
```

Note: fields like `track`, `store`, `branch`, `series`, `repo`, `source`, `os`, `release`, `owner`, `sha256`, `image_url` are family-specific and will be empty strings when not applicable.

#### Search artefacts

```
GET /v1/artefacts/search?q=<string>&families=<csv>&limit=<int>&offset=<int>
```

Returns:
```json
{
  "artefacts": ["bionic-base-amd64.tar.gz", "bionic-base-arm64.tar.gz"],
  "count": 6,
  "limit": 3,
  "offset": 0
}
```

Note: `artefacts` is an array of **name strings**, not full objects.

#### Get single artefact

```
GET /v1/artefacts/{artefact_id}
```

Returns single `ArtefactResponse` (same shape as list above).

#### Get artefact builds

```
GET /v1/artefacts/{artefact_id}/builds
```

Returns array of `ArtefactBuildResponse`:

```json
[
  {
    "id": 10784,
    "architecture": "amd64",
    "revision": null,
    "test_executions": [
      {
        "id": 13763,
        "ci_link": "https://cdimage.ubuntu.com/...",
        "c3_link": null,
        "relevant_links": [
          {"label": "Manual test suite instructions", "url": "https://...", "id": 6050}
        ],
        "environment": {
          "id": 1499,
          "name": "cdimage.ubuntu.com",
          "architecture": "amd64"
        },
        "status": "PASSED",
        "test_plan": "Image build",
        "created_at": "2026-04-02T05:06:52.039221",
        "execution_metadata": {},
        "is_triaged": true,
        "is_rerun_requested": false
      }
    ]
  }
]
```

#### Get artefact versions

```
GET /v1/artefacts/{artefact_id}/versions
```

Returns array of `ArtefactVersionResponse`:
```json
[{"version": "20260401", "artefact_id": 11193}, ...]
```

#### Get environment reviews for an artefact

```
GET /v1/artefacts/{artefact_id}/environment-reviews
```

Returns array of `ArtefactBuildEnvironmentReviewResponse`:
```json
[
  {
    "id": 123,
    "review_decision": ["APPROVED"],
    "review_comment": "",
    "environment": {"id": 1, "name": "env-name", "architecture": "amd64"},
    "artefact_build": {"id": 10784, "architecture": "amd64", "revision": null}
  }
]
```

`review_decision` values: `APPROVED`, `REJECTED`, `NEEDS_FIXING`

#### Update artefact (auth required)

```
PATCH /v1/artefacts/{artefact_id}
```

Body (`ArtefactPatch`, all optional):
```json
{
  "status": "APPROVED",
  "archived": false,
  "stage": "current",
  "comment": "Looks good",
  "assignee_id": 42,
  "assignee_email": "user@canonical.com"
}
```

---

### Test Executions

A test execution links an artefact build to an environment and tracks its test lifecycle.

#### Get single test execution

```
GET /v1/test-executions/{id}
```

Returns `TestExecutionResponse`:
```json
{
  "id": 13763,
  "ci_link": "https://...",
  "c3_link": null,
  "relevant_links": [],
  "environment": {"id": 1499, "name": "cdimage.ubuntu.com", "architecture": "amd64"},
  "status": "PASSED",
  "test_plan": "Image build",
  "created_at": "2026-04-02T05:06:52.039221",
  "execution_metadata": {},
  "is_triaged": true,
  "is_rerun_requested": false
}
```

#### Get test results for an execution

```
GET /v1/test-executions/{id}/test-results
```

Returns array of test results:
```json
[
  {
    "id": 8544,
    "name": "build-image",
    "created_at": "2026-04-02T05:06:52.463291",
    "category": "",
    "template_id": "",
    "status": "PASSED",
    "comment": "Build ISO on Launchpad and cdimage",
    "io_log": "TODO: find a way to send out the build logs here",
    "previous_results": [
      {
        "status": "PASSED",
        "version": "20260401",
        "artefact_id": 11193,
        "test_execution_id": 13590,
        "test_result_id": 8440
      }
    ]
  }
]
```

`previous_results` gives historical status for the same test case across past versions — useful for trend display.

#### Get status update / event log

```
GET /v1/test-executions/{id}/status_update
```

Returns `StatusUpdateRequest` shape with test events.

#### Start a test execution (auth required)

```
PUT /v1/test-executions/start-test
```

Body is one of (discriminated by `family` field):

**Image:**
```json
{
  "family": "image",
  "name": "noble-desktop-amd64.iso",
  "version": "20260402",
  "arch": "amd64",
  "environment": "some-lab",
  "ci_link": "https://...",
  "test_plan": "QA Regression",
  "initial_status": "IN_PROGRESS",
  "relevant_links": [{"label": "Docs", "url": "https://..."}],
  "needs_assignment": false,
  "execution_stage": "pending",
  "os": "ubuntu",
  "release": "noble",
  "sha256": "abc123...",
  "owner": "canonical-foundations",
  "image_url": "https://cdimage.ubuntu.com/..."
}
```

**Snap:**
```json
{
  "family": "snap",
  "name": "firefox",
  "version": "123.0",
  "arch": "amd64",
  "environment": "some-lab",
  "revision": 456,
  "track": "stable",
  "store": "ubuntu",
  "branch": "",
  "execution_stage": "stable",
  "test_plan": "Snap QA",
  "initial_status": "IN_PROGRESS",
  "ci_link": null,
  "relevant_links": [],
  "needs_assignment": false
}
```

**Deb:**
```json
{
  "family": "deb",
  "name": "curl",
  "version": "7.88.0",
  "arch": "amd64",
  "environment": "some-lab",
  "series": "noble",
  "repo": "main",
  "source": "curl",
  "execution_stage": null,
  "test_plan": "Deb QA",
  "initial_status": "IN_PROGRESS",
  "ci_link": null,
  "relevant_links": [],
  "needs_assignment": false
}
```

**Charm:**
```json
{
  "family": "charm",
  "name": "postgresql",
  "version": "1.0",
  "arch": "amd64",
  "environment": "some-lab",
  "revision": 100,
  "track": "latest",
  "branch": "",
  "execution_stage": "edge",
  "test_plan": "Charm QA",
  "initial_status": "IN_PROGRESS",
  "ci_link": null,
  "relevant_links": [],
  "needs_assignment": false
}
```

#### End a test execution (auth required)

```
PUT /v1/test-executions/end-test
```

Body (`EndTestExecutionRequest`):
```json
{
  "ci_link": "https://jenkins.example.com/job/123",
  "c3_link": "https://certification.canonical.com/submissions/123",
  "checkbox_version": "3.0.0",
  "test_results": [
    {
      "name": "test-case-name",
      "template_id": "tmpl-001",
      "status": "pass",
      "category": "functional",
      "comment": "All good",
      "io_log": "stdout output here"
    }
  ]
}
```

#### Patch test execution (auth required)

```
PATCH /v1/test-executions/{id}
```

Body (`TestExecutionsPatchRequest`, all optional):
```json
{
  "c3_link": "https://...",
  "ci_link": "https://...",
  "status": "PASSED",
  "execution_metadata": {}
}
```

#### Manage rerun requests (auth required)

```
GET    /v1/test-executions/reruns?family=image&limit=10&environment=&environment_architecture=&build_architecture=
POST   /v1/test-executions/reruns        — body: {"test_execution_ids": [1,2,3], "test_results_filters": null}
DELETE /v1/test-executions/reruns        — body: {"test_execution_ids": [1,2,3], "test_results_filters": null}
```

`GET reruns` returns array of `PendingRerun`:
```json
[
  {
    "test_execution_id": 13763,
    "ci_link": null,
    "family": "image",
    "test_execution": { ...TestExecutionResponse... },
    "artefact": { ...ArtefactResponse... },
    "artefact_build": {"id": 10784, "architecture": "amd64", "revision": null}
  }
]
```

#### Image respins (cdimage)

cdimage publishes every image as an `Image build` execution on environment `cdimage.ubuntu.com`. Its `rebuild-requests --use-test-observer` cron job (every 5 minutes, per series) reads `GET /v1/test-executions/reruns?family=image&environment=cdimage.ubuntu.com`, keeps the non-archived entries of its series, runs the matching `for-project <os> cron.<image type>` build and deletes each entry it consumes. A rerun request on an image's latest `Image build` execution is therefore a respin request.

Mission Control reads this queue (currently readable without auth) to show queued respins, but cannot create requests itself: the session cookie is `SameSite=Lax` on `tests-api.ubuntu.com`, so browsers don't send it from another site such as GitHub Pages. Respins are requested from Test Observer's own page, `https://tests.ubuntu.com/#/respin?release=<codename>`, which handles sign-in and shows what was queued.

---

### Test Results (cross-execution search)

```
GET /v1/test-results
```

Heavy filter endpoint for querying test results across executions:

| Param | Type | Description |
|-------|------|-------------|
| `families` | csv | e.g. `image,snap` |
| `artefacts` | csv | artefact name filter |
| `artefact_is_archived` | bool | |
| `environments` | csv | environment name filter |
| `test_cases` | csv | test case name filter |
| `template_ids` | csv | |
| `issues` | csv | issue key filter |
| `test_result_statuses` | csv | `PASSED,FAILED,SKIPPED` |
| `test_execution_statuses` | csv | |
| `assignee_ids` | csv | |
| `rerun_is_requested` | bool | |
| `execution_is_latest` | bool | |
| `from_date` | date string | |
| `until_date` | date string | |
| `limit` | int | |
| `offset` | int | |
| `execution_metadata` | json | |

---

### Environments

```
GET /v1/environments?q=<string>&families=<csv>&limit=<int>&offset=<int>
```

Returns paginated `EnvironmentsResponse`:
```json
{
  "environments": [
    {"id": 1499, "name": "cdimage.ubuntu.com", "architecture": "amd64"}
  ],
  "count": 50,
  "limit": 20,
  "offset": 0
}
```

#### Environment reported issues

```
GET    /v1/environments/reported-issues?is_confirmed=<bool>
POST   /v1/environments/reported-issues   — creates a reported issue
PUT    /v1/environments/reported-issues/{issue_id}
DELETE /v1/environments/reported-issues/{issue_id}
```

`EnvironmentReportedIssueResponse`:
```json
{
  "id": 1,
  "environment_name": "cdimage.ubuntu.com",
  "description": "Network flakiness",
  "url": "https://...",
  "is_confirmed": true,
  "created_at": "...",
  "updated_at": "..."
}
```

---

### Issues (bug tracker integration)

Issues are Jira/GitHub/Launchpad bugs linked to test failures.

```
GET /v1/issues?source=jira&project=&status=open&families=image&limit=20&offset=0&q=<search>
```

Returns `IssuesGetResponse`:
```json
{
  "issues": [
    {
      "id": 1,
      "source": "jira",
      "project": "INFRA",
      "key": "INFRA-123",
      "title": "Some bug",
      "status": "open",
      "url": "https://jira.canonical.com/browse/INFRA-123",
      "labels": ["label1"],
      "auto_rerun_enabled": false,
      "attachment_rules": []
    }
  ],
  "count": 42,
  "limit": 20,
  "offset": 0
}
```

```
GET    /v1/issues/{issue_id}
PUT    /v1/issues                         — create/update by URL
PATCH  /v1/issues/{issue_id}
POST   /v1/issues/{issue_id}/attach       — attach to test results
POST   /v1/issues/{issue_id}/detach
POST   /v1/issues/{issue_id}/attachment-rules
PATCH  /v1/issues/{issue_id}/attachment-rules/{rule_id}
DELETE /v1/issues/{issue_id}/attachment-rules/{rule_id}
```

---

### Test Cases

```
GET /v1/test-cases?q=<string>&families=<csv>&limit=<int>&offset=<int>
```

Returns `TestCasesResponse`:
```json
{
  "test_cases": [
    {"test_case": "build-image", "template_id": "tmpl-001"}
  ]
}
```

#### Test case reported issues

```
GET    /v1/test-cases/reported-issues?template_id=&case_name=
POST   /v1/test-cases/reported-issues
PUT    /v1/test-cases/reported-issues/{issue_id}
DELETE /v1/test-cases/reported-issues/{issue_id}
```

---

### Reports

```
GET /v1/reports/test-executions?start_date=2026-01-01&end_date=2026-04-01
GET /v1/reports/test-results?start_date=2026-01-01&end_date=2026-04-01
```

Auth required (`view_report` permission).

---

### Users

```
GET /v1/users?limit=20&offset=0&q=<search>
GET /v1/users/me
GET /v1/users/{user_id}
PATCH /v1/users/{user_id}
```

`AssigneeResponse`:
```json
{
  "id": 1,
  "launchpad_handle": "jdoe",
  "email": "jdoe@canonical.com",
  "launchpad_email": "jdoe@canonical.com",
  "name": "John Doe"
}
```

---

### Teams

```
GET    /v1/teams
POST   /v1/teams                          — body: {name, permissions[], reviewer_families[]}
GET    /v1/teams/{team_id}
PATCH  /v1/teams/{team_id}
POST   /v1/teams/{team_id}/members/{user_id}
DELETE /v1/teams/{team_id}/members/{user_id}
```

`TeamResponse`:
```json
{
  "id": 1,
  "name": "Foundations",
  "permissions": ["view_test", "change_test"],
  "reviewer_families": ["image", "deb"],
  "members": [ ...UserResponse... ]
}
```

---

### Applications (API keys)

```
GET    /v1/applications
POST   /v1/applications                   — body: {name, permissions[]}
GET    /v1/applications/me
GET    /v1/applications/{application_id}
PATCH  /v1/applications/{application_id}  — body: {permissions: [...]}
```

`ApplicationResponse`:
```json
{
  "id": 1,
  "name": "my-ci-app",
  "permissions": ["change_test", "view_test"],
  "api_key": "secret-key-value"
}
```

---

### Permissions

```
GET /v1/permissions
```

Returns the full list of available permissions (requires `view_permission`).

Full permission list:
```
view_user, change_user, view_team, change_team,
add_application, change_application, view_application,
view_permission, view_issue, change_issue,
change_issue_attachment, change_issue_attachment_bulk,
change_attachment_rule, change_auto_rerun,
view_test, change_test, view_rerun, change_rerun, change_rerun_bulk,
view_artefact, change_artefact,
view_environment_review, change_environment_review,
view_report,
view_test_case_reported_issue, change_test_case_reported_issue,
view_environment_reported_issue, change_environment_reported_issue
```

---

## Typical UI Query Flow

To render a dashboard page for a given family:

1. `GET /v1/artefacts?family=image` — list all artefacts
2. For each artefact, `GET /v1/artefacts/{id}/builds` — get builds + test executions inline
3. For a test execution detail, `GET /v1/test-executions/{id}/test-results` — get individual results with history

To search:

1. `GET /v1/artefacts/search?q=bionic&families=image` — returns matching artefact names
2. Then query artefacts by name from the list endpoint

## CORS

The API sets CORS to allow only the production frontend origin. For a new UI on a different origin, you'll need either:
- A server-side proxy that forwards requests to `tests-api.ubuntu.com`
- Or a backend-for-frontend pattern
- Or the API's CORS settings updated to include your origin
