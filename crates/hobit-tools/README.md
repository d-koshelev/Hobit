# hobit-tools

Structured tool and action adapter layer for Hobit.

The current milestone includes a narrow read-only Git status parser/CLI adapter
for `git status --porcelain=v1 -b` against an explicit repository root. It uses
fixed read-only arguments, no shell, timeouts, output caps, no fetch, and no Git
mutations.

It also includes a Codex CLI availability/version probe. The probe runs only
`codex --version` or `<explicit-program> --version` through the bounded process
adapter. The probe does not run `codex exec`, pass prompts, pass repository
paths, edit files, or provide Direct Work execution.

The crate now also includes backend/tooling-only Codex Direct Work runner
foundations. The one-shot runner validates an explicit repository root and
operator prompt, builds `codex exec` with program + argv only, passes
`--cd <repo_root>`, `--sandbox <read-only|workspace-write>`,
`--ask-for-approval <never|on-request|untrusted>`, and
`--output-last-message <path>`, then captures stdout, stderr, final message,
exit status, truncation flags, duration, and a safe command summary. Non-zero
Codex exits are returned as failed structured results.

A streaming runner foundation is also available for `codex exec --json`. It
uses the same explicit repository root, executable resolution, sandbox and
approval mapping, timeout, output caps, no-shell argv construction, prompt
redaction in command summaries, and final-message file capture. It reads stdout
and stderr line-by-line while the process is running and emits caller callback
events for start, stdout/stderr lines, lightweight validated JSON stdout lines,
final message, completion, failure, and timeout. Tauri events, frontend live log
UI, storage persistence, Agent Monitoring integration, Git integration, stdin,
PTY, and interactive sessions are not implemented here.

The Direct Work runners do not support `danger-full-access`.

## Belongs Here

- Tool action boundaries.
- Future adapters for terminal, database, image, and other capabilities.
- Safe local CLI availability/version probes.
- Approval-aware execution interfaces once the contracts are ready.
- Read-only Git status data shaped for visual review surfaces.

The app/Tauri layer may wrap this runner and persist run artifacts; this crate
remains the tool adapter boundary.

## Does Not Belong Here Yet

- Real terminal execution.
- Codex Direct Work UI, storage persistence, Agent Monitoring display, Agent
  Queue execution, or Git Widget integration.
- Git mutations, diff/log/show, staging, commit, push, revert/reset, clean, or stash.
- Real JDBC or database access.
- Real image editing.
- Widget UI.
