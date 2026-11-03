# CheckCom IT Support ticket triage prototype

This adapter executes `customer-support/ticket-triage` as an **offline rule engine**.
An agent or operator supplies a JSON batch and receives categorized, prioritized
CheckCom task drafts with explicit reasons and verifiable investigation steps.
It does not merely produce a prompt/brief. It is also not an LLM, a deployed
autonomous agent, or an automatic repair system.

## Verified source baseline

- Repository default branch `main`, commit `73311b13df9f5c24c201a30f18f134a9c0112a97`, inspected 2026-11-03.
- `department-catalog.json`: 13 plugins, 128 skills; Technical includes
  `customer-support/ticket-triage`; `external_connectors_enabled` is false.
- `department-skills.mjs` / `department-skills-ui.js` create briefs and draft tasks.
  They do not execute a ticket classification workflow.
- `assistant.js` exposes `CheckComTaskGateway.read/write`. Each write creates a
  new random request ID; the browser gateway alone does not establish durable
  ticket identity deduplication. The production server implementation is absent
  from this repository, so server behavior is not established here.
- The repository contains customer-support plugin metadata/license, not the
  ticket-triage skill implementation. This adapter was informed by the
  [upstream guide at the catalog's pinned revision](https://github.com/anthropics/knowledge-work-plugins/blob/2574e29377c7173d0cecffef29a6ecbd7f8ccb5d/customer-support/skills/ticket-triage/SKILL.md).

## Run with synthetic tickets

Node.js 20+; no package installation or API credentials are required. From the
repository root:

```sh
node apps/workflow/ticket-triage-cli.mjs apps/workflow/ticket-triage-samples.json
node --test assistant.test.mjs apps/workflow/*.test.mjs apps/performance/*.test.mjs apps/q4/*.test.mjs
```

The first command is a dry run: JSON goes to stdout. For durable prototype-only
storage, choose a new local file in an existing directory:

```sh
node apps/workflow/ticket-triage-cli.mjs apps/workflow/ticket-triage-samples.json --store /tmp/checkcom-triage-prototype.json
```

Run that command again: five duplicates, zero additional records. No gateway,
HTTP request, customer message, customer record, or production write is involved.
The store uses an exclusive adjacent `.lock`, private temporary file and atomic
rename. A busy lock returns an error; retry after the other writer completes.
After an interrupted process, inspect the store and confirm no writer remains
before removing a stale lock. This is a single-host prototype, not a distributed
database guarantee. Unknown/corrupt existing files are rejected without overwrite.

Exit codes: `0` = processed without input/identity conflicts; `2` = inspect the
reported per-ticket errors or identity conflicts; `1` = command, input-file or
storage failure. Valid independent records can still be processed/saved when
other records have errors. Read the complete report before treating a batch as
accepted.

For the standalone review screen:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/apps/workflow/ticket-triage.html`. It loads five synthetic
examples, analyzes edited JSON and downloads a review JSON. This page does not
import the parent gateway, load real tasks, use browser persistent storage or
save to a central API. Requests are limited to its same-origin static modules and
sample file. The existing CheckCom navigation and production entrypoints are unchanged.

## Input contract

| Field | Accepted value / treatment |
|---|---|
| `source`, `id` | Required nonempty strings, max 80 / 120 characters; stable identity; case-sensitive |
| `title`, `description` | Strings, max 240 / 4000 characters; absent values become explicit missing facts |
| `service` | `network`, `cctv`, `access-control`, `fire-alarm`, `workstation`, `email`, `application`, `unknown` |
| `environment` | `production`, `test`, `unknown` |
| `impact` | `single`, `team`, `site`, `multiple-sites`, `unknown` |
| `affected_users` | Nonnegative safe integer or null/absent |
| `business_blocked`, `workaround_available`, `service_unavailable`, `security_incident`, `data_loss` | Boolean or null/absent; strings such as `"false"` are rejected |
| `owner` | Optional string, max 160 characters; never invent an employee assignment |

At most 500 tickets per batch. Extra input fields are ignored; they do not affect
triage or identity signatures. Strings are trimmed and Unicode-normalized.
Missing identity or malformed values produce a row error and no task for that row.
Missing descriptive/impact facts produce a provisional pending-review task, with
the missing fields listed. An absent security/data-loss flag is not interpreted
as a verified negative.

## Decisions and output

Priority rules run in order:

1. P1: explicitly reported active security incident/data loss, or production
   service outage affecting a whole site/multiple sites. Escalation is the first
   proposed action even when facts are missing. Reports remain unverified.
2. P2: fire-alarm specialist review; blocked work with no confirmed workaround or
   broad impact (site/multiple sites or at least 10 affected users).
3. P2 provisional: missing essential facts, unknown category or a security concern.
4. P4: non-blocking how-to/enhancement, explicitly no service outage.
5. P3: remaining limited-impact/available-workaround reports.

Categories follow the upstream support taxonomy plus `unknown`. Limited English,
Thai and Lao phrases propose categories; they do not understand arbitrary prose,
negation, root causes or every language variation. Structured critical flags take
precedence; urgency words alone never establish a critical incident. A reviewer
must reconcile contradictory prose and structured facts. No SLA, deadline or
customer promise is manufactured from the upstream guide.

Task fields include `priority`, `category`, `next_action`, `action_plan`,
`department: Technical`, `status: รอตรวจสอบ`, `stage: Ticket triage review` and
`department_plugin.approval: pending_review`. Metadata includes rule IDs, the
normalized input signature, decision evidence, missing facts, suggested queue,
and action/verification pairs. Facts have `reported_not_verified` status;
diagnosis is `unconfirmed`; resolution is `not_executed`. Routing recommends a
queue; it does not assign a real employee or notify them.

Deduplication uses the exact normalized `(source, id)` pair, never title or
symptom similarity. Repeated input is skipped across batch runs/processes when
the same local store is used. A changed input/rule version is a conflict, keeping
existing review notes/status intact. Conflicting variants of a new identity in
one batch are withheld; neither is selected for saving. Existing duplicate or
invalid store identities cause a failure. Similar symptoms with different IDs
remain distinct tickets; known-issue search is explicitly `not_connected`.

## Example result

All records below are synthetic, including the simulated production environment.

| Ticket | Priority | Category | Next action | Review status |
|---|---|---|---|---|
| DEMO-001, whole-site network outage | P1 | performance | Escalate to IT Support lead; confirm scope | รอตรวจสอบ |
| DEMO-004, printer report without impact | P2 provisional | unknown | Request missing facts | รอตรวจสอบ |
| DEMO-005, API sync blocks test team | P2 | integration | Inspect existing error/status evidence | รอตรวจสอบ |
| DEMO-002, one demo camera offline | P3 | bug | Inspect camera/NVR/PoE/storage state | รอตรวจสอบ |
| DEMO-003, Lao Wi-Fi lab question | P4 | how-to | Inspect authorized network status/design | รอตรวจสอบ |

See `ticket-triage-example-output.json` for the full executable output.

## Validation and boundaries

On 2026-11-03, Node.js 24.22.1: **35/35 tests passed** (21 existing tests and 14
new triage tests). New coverage includes missing/invalid values; P1–P4 ordering;
English/Thai/Lao classification; critical escalation; sensitive-system guidance;
untrusted ticket instructions; duplicate/conflicting identities; review-field
preservation; corrupt-store rejection; concurrent writers; retry across separate
processes; dry-run behavior; partial errors and input/store path collision.
CLI tests block `fetch` and Node HTTP/HTTPS requests. Syntax and diff whitespace
checks also pass. Browser visual testing was not completed: the runtime has no
installed Chromium executable. The review page is a prototype requiring browser
acceptance before deployment. No deployed CheckCom system was tested.

| Capability | State |
|---|---|
| Structured input → categorized/prioritized review tasks | Executable locally, tested |
| Evidence, missing facts, proposed checks and queue | Executable locally, tested; recommendations remain unverified |
| Durable exact-ticket deduplication | Local prototype store only, tested |
| Department brief adapter / catalog guides | Existing brief/guide functions; unchanged |
| LLM reasoning, webhook intake, scheduler, support-platform/known-issue search | Not implemented or connected |
| Central API write, distributed deduplication, production field acceptance | Not connected or verified |
| Repairs, configuration changes, customer messages, deployment | Not executed |

Before an approved staging integration: agree the real ticket source and field
mapping, review the priority policy with the Support lead, establish server-side
uniqueness/idempotency on source+ID, preserve review history, and verify the real
API's accepted status/metadata contract. Keep model/connector access disabled until
the data destination and scope have been approved. This branch is reviewable and
must not be treated as a production rollout.
