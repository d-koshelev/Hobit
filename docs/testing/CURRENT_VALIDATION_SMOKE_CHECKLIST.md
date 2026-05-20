# Current Validation Smoke Checklist

## Purpose

This checklist records the Phase 1 validation/bootstrap smoke baseline.

It is a process checklist only. It must not claim full validation passes unless
the command actually passes in the local environment.

## Status Labels

- Passing: command or check completed successfully.
- Expected environment failure: the check fails because required local
  bootstrap state is absent, and the failure is expected/actionable.
- Known warning: the check passes or proceeds but reports a documented warning.
- Unresolved blocker: the check exposes a failure that is not explained by the
  current baseline.
- Not run: the check was skipped or intentionally not executed.

## Baseline Checks

| Check | Current Phase 1 expectation |
| --- | --- |
| `git status --short --branch` | Required before final reporting. Passing means Git is usable and the focused task can identify unrelated dirty files. |
| `cargo check --workspace` | Passing in the current baseline, with known pre-existing Terminal PTY dead-code warnings in `apps/desktop/src-tauri/src/terminal_pty.rs`. |
| `cargo test --workspace` | Passing in the current baseline after Terminal PTY lifecycle tests were gated by platform support. |
| `bash -n scripts/hobit/validate.sh` | Passing in the current baseline. |
| `bash scripts/hobit/validate.sh` | Passing only when required frontend dependencies are installed. If `apps/desktop/frontend/node_modules` or local `node_modules/.bin/tsc` is absent, the expected result is an actionable missing-dependency failure before frontend validation runs. |
| direct `scripts/hobit/validate.sh` | Known local filesystem caveat: direct execution can fail with `Permission denied` when the local materialized mode is not executable even though Git records executable mode. Use `bash scripts/hobit/validate.sh` for the baseline check unless a task explicitly validates file mode materialization. |
| scoped `git diff --check -- <paths>` | Required for focused tasks when pre-existing unrelated dirty files exist. Scope it to touched files instead of broad cleanup. |

## Missing Frontend Dependencies

When frontend dependencies are absent, `bash scripts/hobit/validate.sh` should
fail before frontend validation with an actionable message that identifies the
missing local TypeScript toolchain and the bootstrap command:

```text
npm ci --prefix apps/desktop/frontend
```

For tasks that explicitly say not to install dependencies, this is an Expected
environment failure, not proof that Rust validation failed and not proof that
full validation passed.

## Reporting Rules

- Report each required check as Passing, Expected environment failure, Known
  warning, Unresolved blocker, or Not run.
- Do not claim `validate.sh` fully passed unless frontend dependencies were
  installed and the command actually completed successfully.
- Do not run `npm ci`, `npm install`, frontend typecheck, frontend build,
  `cargo check`, or `cargo test` when a task explicitly forbids them.
- When unrelated dirty files exist, report them as pre-existing and do not
  stage, modify, or whitespace-clean them during a focused docs task.
