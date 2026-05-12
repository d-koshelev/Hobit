# Direct Mode MVP Checklist

## Purpose

This checklist validates the current Direct Mode MVP before adding higher-risk
features such as diff summaries, validation capture, cancellation, commit
support, or interactive sessions.

It is an audit and manual validation checklist only. It does not implement new
runtime behavior, frontend UI, backend commands, storage, schema, Git
mutation, diff capture, validation capture, queue execution, cancellation, PTY,
or interactive execution.

## Current Direct Mode MVP Summary

Implemented Direct Mode surfaces:

- Direct Work / Codex catalog entry.
- Agent Monitoring / `agent-run` widget ownership for Direct Work artifacts.
- Codex executable override and Windows `codex.cmd` default/fallback support.
- `read_only` and `workspace_write` sandbox selection.
- Approval policy selection, with `never` recommended for one-shot
  non-interactive runs.
- Streaming Direct Work run.
- Live log overview messages.
- Final response and result summary.
- Timing display.
- Changed-files summary from read-only Git status.
- Git Widget auto repo-root handoff and read-only refresh.
- No auto-commit.
- No auto-push.
- No Git mutation by Hobit.

## Explicit Non-Goals / Not Implemented

- No commit, push, stage, reset, or clean.
- No Git mutation.
- No diff capture.
- No semantic code analysis.
- No validation capture.
- No cancellation or stop-run control.
- No queue execution.
- No approval/apply workflow.
- No PTY.
- No interactive Codex TUI.
- No background daemon.
- No dangerous mode UI.
- No automatic cleanup of files created by Codex.

## Manual Smoke Flow A - Read-Only Direct Work

- [ ] Open or add Direct Work / Codex.
- [ ] Set repo root to the Hobit repository.
- [ ] Use the default Codex executable, `codex.cmd` on Windows.
- [ ] Set sandbox to `read_only`.
- [ ] Set approval policy to `never`.
- [ ] Use this prompt:

```text
Return exactly: Hobit read-only Direct Work smoke. Do not edit files.
```

Confirm:

- [ ] The run starts without executable or argv errors.
- [ ] The run id appears early.
- [ ] The live log updates during the run.
- [ ] Messages are human-readable, not repeated raw Codex event labels.
- [ ] The final response appears.
- [ ] Status is `completed`.
- [ ] The changed-files summary does not claim new changes from the read-only
  run.
- [ ] No commit, push, stage, reset, or clean occurred.

## Manual Smoke Flow B - Workspace-Write Direct Work

- [ ] Set repo root to the Hobit repository.
- [ ] Use the default Codex executable, `codex.cmd` on Windows.
- [ ] Set sandbox to `workspace_write`.
- [ ] Set approval policy to `never`.
- [ ] Use this prompt:

```text
Create a file named tmp_hobit_direct_work_smoke_mvp.txt in the repository root with exactly this text:
Hobit Direct Work MVP smoke

Do not modify any other files.
Do not commit.
Do not push.
```

Confirm:

- [ ] The run starts.
- [ ] The live log updates during the run.
- [ ] The final response appears.
- [ ] The changed-files summary shows the smoke file as untracked or changed.
- [ ] The Git Widget auto-uses the Direct Work repo root.
- [ ] The Git Widget read-only refresh shows the same repo state.
- [ ] Auto commit is `No`.
- [ ] Auto push is `No`.
- [ ] Git mutations by Hobit is `No`.
- [ ] No commit, push, stage, reset, or clean occurred.

Cleanup:

- [ ] Remove `tmp_hobit_direct_work_smoke_mvp.txt` before committing anything.

## Manual Smoke Flow C - Failure Observability

Use an intentionally invalid repo root or another impossible prompt scenario
only if it is safe for the current machine and repository.

Confirm:

- [ ] The failure reason is visible.
- [ ] `failed_stage`, error message, stderr preview, and exit code are visible
  when available.
- [ ] The UI does not show only generic `Run failed` copy.
- [ ] Fallback behavior is understandable if streaming cannot start.

## Git Widget Read-Only Boundaries

- The Git Widget may auto-fill the Direct Work repo root.
- The Git Widget may refresh read-only status for that repo root.
- The Git Widget must not stage, commit, push, reset, clean, or otherwise
  mutate the repository in this MVP.
- The Direct Work changed-files summary is read-only Git status, not a diff.
- The Direct Work changed-files summary is not a semantic explanation of code
  changes.

## Direct Mode MVP Readiness Criteria

Direct Mode MVP is ready for demo when:

- [ ] Read-only smoke passes.
- [ ] Workspace-write smoke passes.
- [ ] The live log is readable.
- [ ] The changed-files summary appears.
- [ ] The Git Widget read-only refresh works.
- [ ] No auto-commit, auto-push, or Git mutation occurs.
- [ ] Errors are actionable.
- [ ] Smoke files are removed before commit.

## Recommended Next Feature Blocks

Future options after the MVP smoke passes:

- Validation capture.
- Diff summary.
- Cancellation / stop run.
- Direct Work run history.
- Explicit commit support.
- Semantic diff summary.
- Interactive Codex / PTY session, later.

## Current Recommendation

Pause and perform the manual MVP smoke flows before adding validation capture,
diff summary, cancellation, commit support, or interactive sessions.

Proceed to validation capture or diff summary only after the read-only,
workspace-write, and failure-observability smoke checks pass.
