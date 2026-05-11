# Hobit Toolbelt

The Hobit Toolbelt is a small repo-local set of deterministic scripts for common
repository inspection and validation tasks.

Codex and other agents should check `scripts/hobit/` before writing one-off
inspection scripts. If a repeated inspection need is missing, propose a reusable
Toolbelt script instead of leaving temporary helper scripts in the repository.

## Rules

- Run scripts from the repository root.
- Scripts use predictable exit codes: `0` ok, `1` check failed, `2`
  usage/environment error.
- Scripts avoid external Python dependencies.
- Scripts ignore generated, vendor, and local archive artifacts such as `.git`,
  `target`, `node_modules`, `dist`, `apps/desktop/src-tauri/gen`, and `*.zip`.
- Inspection scripts are read-only. `validate.ps1` and `validate.sh` run the
  mandated validation sequence, including `cargo fmt --all`.

## Scripts

### `validate.ps1`

Windows/PowerShell validation wrapper:

```powershell
scripts/hobit/validate.ps1
scripts/hobit/validate.ps1 --help
```

Runs frontend typecheck/build, Rust formatting/check/tests, file-size checks,
Git whitespace checks, and final Git status. It stops on the first failure.
On Windows machines where `python.exe` is only the Microsoft Store alias, set
`HOBIT_PYTHON` to a real Python executable if auto-detection cannot find one.

### `validate.sh`

Unix/Linux validation wrapper:

```sh
scripts/hobit/validate.sh
scripts/hobit/validate.sh --help
```

Uses `npm` instead of `npm.cmd` and runs the same sequence as the PowerShell
wrapper.

### `check-file-sizes.py`

Checks source file line counts against Hobit code organization thresholds:

```sh
python scripts/hobit/check-file-sizes.py
python scripts/hobit/check-file-sizes.py --changed-only
python scripts/hobit/check-file-sizes.py --fail-on-warning
python scripts/hobit/check-file-sizes.py --json
```

Use this before adding to existing large files. It has explicit facade limits for
`crates/hobit-storage-sqlite/src/store.rs` and
`crates/hobit-app/src/workspace_service.rs`.

### `module-map.py`

Prints a compact directory/module map with line counts:

```sh
python scripts/hobit/module-map.py
python scripts/hobit/module-map.py --path crates/hobit-app/src --max-depth 3
python scripts/hobit/module-map.py --path crates/hobit-storage-sqlite/src --json
```

Use this to understand module shape before moving or adding code.

### `changed-files-summary.py`

Summarizes changed files by repository area and suggests validation:

```sh
python scripts/hobit/changed-files-summary.py
python scripts/hobit/changed-files-summary.py --json
```

Use this before final validation and in final-report preparation.
