# Queue Dogfood Milestone 001

## Summary

The Hobit Queue dogfood loop is implemented up to the external provider readiness gate. The first Queue dogfood task completed through a real `codex.cmd` worker, and the Hobit Coordinator accepted/finalized that completed dependency. The next task, `dogfood-file-import-hardening`, is blocked only by external Codex provider reachability.

No Hobit-side Queue lifecycle, Prompt Pack materialization, scheduler, worker identity, or credential workaround should be changed for the current blocker.

## Working Hobit-Side Capabilities

- Backend-owned Prompt Pack parser and preview.
- Backend-owned Prompt Pack materialization.
- Durable pack/task mapping.
- Transactional dependency remap from pack task ids to generated Queue task ids.
- Selected-task `queue_local` start bridge.
- App-owned dogfood operator endpoint.
- Dogfood app profile and persisted dogfood Workspace binding.
- Provider readiness gate before real selected-task start/retry/resume.
- Read-only run detail/status inspection.
- Explicit retry semantics for terminal failed selected tasks.
- Hobit Coordinator `--resume-dogfood` loop.
- Worker/operator control boundary.
- Endpoint token moved outside worker-accessible workspace paths and not exposed to workers.

## Evidence

- `dogfood-foundation-checkpoint` selected Queue task: `queue_task_prompt_pack_1782673287717627000_5`
- Successful runLinkId: `queue_run_link_1782736983771218900_8`
- Completion status: `completed`
- Terminal Queue task status: `completed`
- Accepted/finalized by coordinator: yes
- Next task: `dogfood-file-import-hardening`
- Next task selected Queue task: `queue_task_prompt_pack_1782673287717489200_4`
- Next task status: not launched
- Reason: provider readiness blocked

Primary evidence reports:

- `docs/dogfood/reports/queue-dogfood-run-012.md`
- `docs/dogfood/reports/queue-dogfood-resume-001.md`
- `docs/dogfood/reports/queue-dogfood-run-014.md`
- `docs/dogfood/reports/queue-dogfood-run-015.md`

## External Blocker

- Classification: `system_schannel_acquire_credentials_failure`
- Direct `codex.cmd doctor --json` final status: `fail`
- `auth.credentials`: `ok`
- `network.provider_reachability`: `fail`
- `network.websocket_reachability`: `warning`
- DNS/TCP: ok
- Node HTTPS: ok
- Windows Schannel clients: fail before HTTP with `SEC_E_NO_CREDENTIALS`
- Safe Hobit-side workaround applied: no
- Credential files modified: no

This blocker is outside Hobit Queue. Hobit should continue to refuse selected-task starts while provider readiness is blocked.

## Continuation Condition

Dogfood can resume only after:

```powershell
codex.cmd doctor --json
```

returns healthy, and:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
```

returns `status=ready`.

## Correct Resume Command

After external provider repair, use the Hobit Coordinator resume command:

```powershell
node scripts/hobit/run-queue-dogfood-operator.mjs --resume-dogfood --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-run-016.md
```

Expected selected task: `dogfood-file-import-hardening`.

## Boundaries Held

- `widget_runs`: no
- Scheduler/autodispatch: no
- Dependent auto-start: no
- Direct DB probing canonical: no
- Frontend materializer canonical: no
- Frontend lifecycle canonical: no
- Worker operator token access: no
- Secrets logged: no
- Real worker launched during stabilization: no
- New run link created during stabilization: no
