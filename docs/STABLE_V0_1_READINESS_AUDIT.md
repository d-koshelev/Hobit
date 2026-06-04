# Stable v0.1 Readiness Audit

Audit date: 2026-06-04

Mode: docs-producing inspect-only audit

Audited implementation HEAD before this docs-only file: `88889d7`

## 1. Executive summary

- Readiness: ready for Stable v0.1 candidate status; not ready for final
  Stable v0.1 acceptance until manual smoke is recorded.
- Main remaining blockers: manual desktop smoke for the full dogfooding loop,
  platform-specific Terminal/Finder Git/JDBC Preview smoke, and a small amount
  of stale status/copy cleanup in older audit docs and Finder catalog wording.
- Candidate tag recommendation: tag the current implementation as
  `stable-v0.1-candidate.1` after this audit is reviewed. If the audit document
  should be included in the tagged tree, tag the docs commit that contains this
  file; otherwise tag implementation HEAD `88889d7`.
- Manual smoke status: pending. Manual smoke is the remaining final acceptance
  gate, not an automatic blocker.

Current automatic evidence does not show a release-blocking ratchet, unsafe
hidden automation path, product catalog exposure of Agent Executor/Git, or
unsupported Stable v0.1 product-surface claim. Full npm/cargo validation was
intentionally not run in this inspect-only audit.

## 2. Component readiness table

| Component | Current state | Readiness | Blockers | Stable v0.1 decision |
| --- | --- | --- | --- | --- |
| Workspace Agent | Foreground `interactive-agent` compatibility surface with visible chat/proposals, visible attachments, Codex Direct Work, Queue proposal/action paths, Knowledge snippets for explicit Codex runs, and `allowed_tools: []`. | Candidate-ready | Manual smoke for provider visible-context, independent threads, Queue/Knowledge/Note proposal actions, and Direct Work working-directory isolation. | Include as Ready / MVP primary surface. |
| Agent Queue | Task create/list/update/delete, assignment, explicit starts, run links, closure states, no-change/follow-up/report-ready flows, and operator-armed current-session runner behavior. Queue result commit path exists as an explicit operator action and does not push or finalize automatically. | Candidate-ready | Manual dogfooding smoke for create/assign/run/report/commit-or-no-change/follow-up/finalization boundaries. | Include as Stable v0.1 core surface. |
| Finder | Product-facing file/project navigation with explicit root, column navigation, bounded preview, edit/save/cancel, floating preview state, and Knowledge task/source integration. | Candidate-ready | Manual smoke for root approval, edit dirty-state behavior, capped/binary/unsupported files, and no hidden context attachment. Catalog copy still understates Finder as read-only preview. | Include as Stable v0.1 product surface. |
| Finder Git plugin | Finder-owned Workspace Git status/diff/history/manual selected-file commit/manual push path with visible branch/upstream/ahead-behind checks. | Candidate-ready | Manual smoke for selected-file commit, safe push preconditions, no force/push-all/reset/clean/stash/branch management, and no auto-push after commit. | Include as Finder-owned Git capability. |
| Terminal | Explicit desktop PTY-first command surface with explicit shell/cwd, session-only buffer, stop/kill/close, and collapsed one-shot fallback. Windows/Linux live PTY support; unsupported platforms report unsupported. | Candidate-ready | Manual supported-platform PTY smoke and unsupported-platform honesty smoke. | Include as Ready / MVP explicit command surface. |
| Notes | Workspace-local notes list/filter/create/select/edit/save/pin through workspace APIs; desktop persistence and dev memory fallback. | Candidate-ready | Manual desktop persistence and no-hidden-Agent-read smoke. | Include as Ready / MVP notes surface. |
| Knowledge / Skills | Ready / MVP with Skill CRUD/attach, workspace/global Knowledge Documents, import/search, quick summaries, Queue generation drafts, draft review, Notes promotion, Finder integration, and frontend-local Queue context attach/materialization. | Candidate-ready | Manual Knowledge smoke; durable Queue-owned context and full Catalog remain out of scope. | Include as Ready / MVP, not full Knowledge Catalog. |
| JDBC Preview | Product-facing preview with non-secret connector/profile metadata, bounded mock/safe read-only SQL path, opt-in experimental sidecar diagnostics/prototype, and Boundary Finder preview without probe execution. | Candidate-ready as Preview | Manual Preview smoke for metadata, secret rejection, unsafe SQL rejection, caps/errors, and no Workspace Agent SQL execution. | Include as Database / JDBC Preview only. |
| Workspace Queue API | Workspace-owned Queue API slice for snapshot/create/update and related current Queue ownership paths. | Candidate-ready | Broader durable context/finalization APIs remain future. | Include as supporting Stable v0.1 API. |
| Workspace Git API | Explicit-root status, diff summary, file diff, log, local commit, and manual push bridge used by Finder and explicit review paths. | Candidate-ready | Manual push/commit guardrail smoke. | Include as Finder-owned/supporting API, not standalone Git product widget. |
| Validation/file-size | `python scripts/hobit/check-file-sizes.py` passes and reports only 33 unchanged/improved legacy oversized files. | Candidate-ready | Legacy debt remains cleanup debt, not a current ratchet blocker. Full npm/cargo validation not run in this audit. | Accept for candidate; require normal validation evidence before final acceptance/release. |

## 3. Automatic acceptance state

- Docs alignment: authoritative docs are mostly aligned. `docs/ACTIVE_CONTRACT_INDEX.md`,
  `docs/CURRENT_WIDGET_SURFACE.md`, `docs/HOBIT_STABLE_V0_1_CONTRACT.md`,
  Knowledge context decisions, and acceptance docs describe the current Stable
  v0.1 surface and boundaries. Older status docs such as
  `docs/STABLE_V0_1_POST_RUN_AUDIT.md`,
  `docs/STABLE_V0_1_FILESIZE_GATE_AUDIT.md`, and parts of
  `docs/KNOWLEDGE_POST_RUN_AUDIT.md` contain stale blocker language from
  earlier runs.
- File-size gate: current full Toolbelt file-size check passes. It scanned 769
  source files and reported only accepted legacy debt, with no ratchet
  violations and no new oversized warnings.
- Test/build status: this audit did not run npm/cargo validation by request.
  Available status docs record focused Knowledge automated coverage, but final
  Stable acceptance still needs a dated validation record on the candidate
  commit.
- Hidden automation risks: targeted inspection found visible guardrails for
  `allowed_tools: []`, no hidden Queue execution, no automatic acceptance, no
  Agent-triggered Terminal/JDBC execution, no hidden memory, no automatic Skill
  injection, no auto-push, and no auto-finalization. Queue result commit and
  Finder commit/push are explicit operator-triggered paths that need manual
  smoke.
- Deprecated product surfaces: catalog templates expose Workspace Agent, Agent
  Activity, Agent Queue, Knowledge / Skills, Notes, Terminal, Finder, Database
  / JDBC, and Runbook only. `agent-run` and standalone `git` remain registry
  compatibility definitions, but are filtered from normal catalog templates.

## 4. Manual smoke still required

- Full desktop start/isolation smoke: isolated database, create Workspace,
  default Workspace Agent plus Notes, reopen recent Workspace, verify no raw
  prompts/logs/results/secrets in summaries, create second Workspace and verify
  isolation.
- Workbench shell smoke: add every product-facing widget, move/resize, layout
  lock, float/dock with ghost placeholder, remove with confirmation, widget
  logs ownership.
- Workspace Agent smoke: visible-context prompt/proposal flow, approved drafts
  require separate create actions, Knowledge/Skill/Note/Queue/JDBC proposal
  boundaries, `allowed_tools: []`, multiple Workspace Agent instances, thread
  reset/isolation on working-directory changes.
- Queue dogfooding smoke: create task, create from Workspace Agent, edit/save,
  assign/clear, explicit start, run-link metadata, report ready not final,
  result commit/no-change/follow-up/blocked closure, no auto-finalization.
- Queue Autorun smoke: explicit arm/start only, one eligible task at a time,
  current-session behavior, no durable scheduler or hidden dispatch.
- Agent Executor support smoke: explicit Direct Work run, logs/result/stop,
  validation capture, no auto-commit/push/acceptance, no shell mode.
- Agent Activity smoke: current-session timeline from Workspace Agent/Executor,
  collapsed raw details, no execution or persistence claim.
- Notes smoke: create/select/edit/save/pin/filter, desktop persistence, no
  existing Notes read/summarize/send by Workspace Agent.
- Knowledge / Skills smoke: Skill CRUD/attach; workspace/global Knowledge
  Document CRUD/import/search; enabled-only visible snippets; disabled/rejected
  blocking; draft review accept/reject; Notes promotion; Finder generation
  task; Queue attach/materialize visible context before explicit run.
- Terminal smoke: supported-platform PTY start/input/ANSI/resize/stop/kill/close,
  session-only output, collapsed one-shot fallback, no Workspace Agent/Queue
  control, unsupported-platform honesty where applicable.
- Finder smoke: explicit root, column navigation, bounded preview, edit save
  and cancel, dirty selection blocking, capped/binary/permission states, no
  Terminal launch or hidden Workspace Agent context.
- Finder Git / Workspace Git smoke: status, selected diff, history, selected-file
  local commit with confirmation, manual push with upstream/ahead/behind review,
  stale/behind/detached/no-upstream blockers, no force/push-all/reset/clean/stash.
- JDBC Preview smoke: connector/profile metadata, no stored secrets, safe
  read-only mock query, unsafe SQL rejection, visible caps/errors, Boundary
  Finder no-probe behavior, no Workspace Agent SQL execution.
- Runbook Preview smoke: manual step states and local notes/evidence only; no
  persistence, execution, Queue/Terminal/Git/Agent integration.
- Product UI smoke: catalog/product names, deprecated surfaces absent, preview
  honesty, approval/execution/acceptance separation, no raw one-off surface.

## 5. Stable v0.1 known limitations

- Database / JDBC is Preview only. Default query execution remains bounded
  mock/safe behavior; production external database execution and credentials
  are not Stable v0.1.
- Queue Knowledge / Skills context is frontend-local/current-session unless
  included indirectly in an explicit materialized run prompt. It is not durable
  Queue-owned context storage or full execution evidence.
- Knowledge / Skills is not a full Knowledge Catalog. It has partial
  catalog-shaped Knowledge Document fields, quick summaries, source labels, and
  lifecycle/status, but no standalone Catalog store, graph relations, Evidence,
  Context Packs, embeddings, folder scanning, binary parsing, team/server
  sharing, or RBAC.
- Draft review rejected decisions are review-local for Stable v0.1 unless the
  operator records them through existing explicit Queue surfaces. Accepted
  drafts persist only through explicit Knowledge Document creation.
- Quick summaries can still be empty on some manual/import paths; this is a
  quality limitation, not a full Catalog blocker.
- File-size validation still reports 33 unchanged/improved legacy oversized
  files. They are accepted legacy debt for candidate status and should be
  reduced when touched.
- Manual smoke is pending and remains the final Stable v0.1 acceptance gate.
- Terminal live PTY support is Windows/Linux; macOS and other unsupported
  desktop platforms remain unsupported/deferred.
- Agent Activity is current-session only and does not persist timeline history.
- Finder approved roots, Finder navigation state, Terminal PTY buffers, and
  Queue prepared Knowledge context are not durable Workspace memory.

## 6. Recommended next steps

1. Commit this audit document and tag the candidate tree as
   `stable-v0.1-candidate.1`.
2. Run the full Stable v0.1 manual smoke checklist in an isolated desktop
   database and record date, tester, OS, launch method, database path, and
   commit under test.
3. Run normal final validation for the candidate commit, including Toolbelt,
   Rust, frontend typecheck, and frontend build where the environment allows.
4. Fix only smoke-found blockers or authoritative-doc inconsistencies; do not
   add new Stable v0.1 behavior during acceptance.
5. Prepare the final Stable v0.1 acceptance report and tag final Stable only
   after manual smoke and validation are recorded.
