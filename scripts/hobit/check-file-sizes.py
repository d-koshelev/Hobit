#!/usr/bin/env python3
"""Check Hobit source file sizes against project organization thresholds."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


EXIT_OK = 0
EXIT_CHECK_FAILED = 1
EXIT_USAGE_OR_ENVIRONMENT = 2

IGNORED_DIRS = {
    ".git",
    ".vite",
    "target",
    "node_modules",
    "dist",
    "gen",
}
IGNORED_PATHS = {
    Path("apps/desktop/src-tauri/gen"),
}
SOURCE_EXTENSIONS = {
    ".rs",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".ps1",
    ".sh",
}
SPECIAL_LIMITS = {
    Path("crates/hobit-storage-sqlite/src/store.rs"): (250, 300, "sqlite store facade"),
    Path("crates/hobit-app/src/workspace_service.rs"): (300, 400, "workspace service facade"),
}


@dataclass(frozen=True)
class Limit:
    warning: int
    error: int
    kind: str


@dataclass(frozen=True)
class Finding:
    path: str
    lines: int
    severity: str
    threshold: int
    limit_kind: str


def repo_root() -> Path:
    root = Path.cwd()
    if not (root / "AGENTS.md").is_file() or not (root / "Cargo.toml").is_file():
        raise RuntimeError("run this script from the Hobit repository root")
    return root


def is_ignored(path: Path) -> bool:
    if path.name.endswith(".zip"):
        return True

    parts = path.parts
    if any(part in IGNORED_DIRS for part in parts):
        return True

    return any(path == ignored or ignored in path.parents for ignored in IGNORED_PATHS)


def is_source_file(path: Path) -> bool:
    return path.suffix in SOURCE_EXTENSIONS and not is_ignored(path)


def changed_paths(root: Path) -> set[Path]:
    try:
        diff = subprocess.run(
            ["git", "diff", "--name-only", "HEAD", "--"],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        untracked = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as error:
        raise RuntimeError(f"failed to run git: {error}") from error

    if diff.returncode != 0:
        raise RuntimeError(diff.stderr.strip() or "git diff failed")
    if untracked.returncode != 0:
        raise RuntimeError(untracked.stderr.strip() or "git ls-files failed")

    paths: set[Path] = set()
    for line in [*diff.stdout.splitlines(), *untracked.stdout.splitlines()]:
        if not line:
            continue
        path = Path(line)
        if (root / path).is_file():
            paths.add(path)
    return paths


def iter_source_files(root: Path, changed_only: bool) -> Iterable[Path]:
    if changed_only:
        candidates = changed_paths(root)
    else:
        candidates = (
            path.relative_to(root)
            for path in root.rglob("*")
            if path.is_file()
        )

    for path in sorted(candidates, key=lambda item: item.as_posix()):
        if is_source_file(path):
            yield path


def line_count(path: Path) -> int:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        return sum(1 for _ in handle)


def limit_for(path: Path) -> Limit:
    if path in SPECIAL_LIMITS:
        warning, error, kind = SPECIAL_LIMITS[path]
        return Limit(warning=warning, error=error, kind=kind)

    name = path.name
    if is_test_file(path):
        return Limit(warning=1200, error=1800, kind="test file")
    if name in {"lib.rs", "main.rs", "mod.rs"}:
        return Limit(warning=300, error=500, kind="root/facade file")
    return Limit(warning=700, error=1000, kind="source file")


def is_test_file(path: Path) -> bool:
    name = path.name
    return (
        name == "tests.rs"
        or name.endswith("_test.rs")
        or name.endswith(".test.ts")
        or name.endswith(".test.tsx")
        or name.endswith(".spec.ts")
        or name.endswith(".spec.tsx")
        or "tests" in path.parts
    )


def check_files(root: Path, changed_only: bool) -> tuple[list[Finding], int]:
    findings: list[Finding] = []
    scanned = 0
    for relative_path in iter_source_files(root, changed_only):
        scanned += 1
        count = line_count(root / relative_path)
        limit = limit_for(relative_path)
        severity = None
        threshold = 0
        if count > limit.error:
            severity = "error"
            threshold = limit.error
        elif count > limit.warning:
            severity = "warning"
            threshold = limit.warning

        if severity is not None:
            findings.append(
                Finding(
                    path=relative_path.as_posix(),
                    lines=count,
                    severity=severity,
                    threshold=threshold,
                    limit_kind=limit.kind,
                )
            )
    return findings, scanned


def print_human(findings: list[Finding], scanned: int) -> None:
    print(f"File size check scanned {scanned} source files.")
    if not findings:
        print("No file size warnings or errors.")
        return

    for finding in findings:
        print(
            f"{finding.severity.upper()}: {finding.path} "
            f"{finding.lines} lines > {finding.threshold} "
            f"({finding.limit_kind})"
        )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Check Hobit source file sizes against organization thresholds."
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    parser.add_argument(
        "--changed-only",
        action="store_true",
        help="check only changed and untracked source files",
    )
    parser.add_argument(
        "--fail-on-warning",
        action="store_true",
        help="return exit code 1 when warnings are present",
    )
    args = parser.parse_args(argv)

    try:
        root = repo_root()
        findings, scanned = check_files(root, args.changed_only)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    errors = [finding for finding in findings if finding.severity == "error"]
    warnings = [finding for finding in findings if finding.severity == "warning"]

    if args.json:
        print(
            json.dumps(
                {
                    "scanned": scanned,
                    "warnings": len(warnings),
                    "errors": len(errors),
                    "findings": [finding.__dict__ for finding in findings],
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print_human(findings, scanned)

    if errors or (args.fail_on_warning and warnings):
        return EXIT_CHECK_FAILED
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
