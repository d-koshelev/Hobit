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
BASELINE_PATH = Path("scripts/hobit/file-size-baseline.json")
SPECIAL_LIMITS = {
    Path("crates/hobit-storage-sqlite/src/store.rs"): (250, 300, "sqlite store facade"),
    Path("crates/hobit-app/src/workspace_service.rs"): (300, 400, "workspace service facade"),
}


@dataclass(frozen=True)
class BaselineEntry:
    lines: int


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
    status: str
    baseline_lines: int | None = None


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


def load_baseline(root: Path) -> dict[str, BaselineEntry]:
    baseline_path = root / BASELINE_PATH
    if not baseline_path.is_file():
        return {}

    try:
        with baseline_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{BASELINE_PATH.as_posix()} is not valid JSON: {error}") from error

    files = data.get("files")
    if not isinstance(files, dict):
        raise RuntimeError(f"{BASELINE_PATH.as_posix()} must contain a 'files' object")

    baseline: dict[str, BaselineEntry] = {}
    for path, entry in files.items():
        if not isinstance(path, str) or not isinstance(entry, dict):
            raise RuntimeError(f"{BASELINE_PATH.as_posix()} contains an invalid file entry")
        lines = entry.get("lines")
        if not isinstance(lines, int) or lines < 1:
            raise RuntimeError(
                f"{BASELINE_PATH.as_posix()} has invalid line count for {path!r}"
            )
        baseline[path] = BaselineEntry(lines=lines)

    return baseline


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


def finding_status(path: str, lines: int, baseline: dict[str, BaselineEntry]) -> tuple[str, int | None]:
    entry = baseline.get(path)
    if entry is None:
        return "active", None
    if lines > entry.lines:
        return "ratchet", entry.lines
    return "debt", entry.lines


def check_files(
    root: Path,
    changed_only: bool,
    baseline: dict[str, BaselineEntry],
) -> tuple[list[Finding], int]:
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
            path = relative_path.as_posix()
            status, baseline_lines = finding_status(path, count, baseline)
            findings.append(
                Finding(
                    path=path,
                    lines=count,
                    severity=severity,
                    threshold=threshold,
                    limit_kind=limit.kind,
                    status=status,
                    baseline_lines=baseline_lines,
                )
            )
    return findings, scanned


def print_human(findings: list[Finding], scanned: int) -> None:
    print(f"File size check scanned {scanned} source files.")
    if not findings:
        print("No file size warnings or errors.")
        return

    debt = [finding for finding in findings if finding.status == "debt"]
    ratchets = [finding for finding in findings if finding.status == "ratchet"]
    active = [finding for finding in findings if finding.status == "active"]
    if debt:
        print(f"Legacy file-size debt: {len(debt)} unchanged/improved oversized file(s).")
    if ratchets:
        print(f"File-size ratchet violations: {len(ratchets)} worsened baseline file(s).")
    if active:
        print(f"New oversized files: {len(active)} file(s).")

    ordered = [*ratchets, *active, *debt]
    for finding in ordered:
        if finding.status == "ratchet":
            print(
                f"RATCHET: {finding.path} {finding.lines} lines > "
                f"baseline {finding.baseline_lines} "
                f"(threshold {finding.threshold}, {finding.limit_kind})"
            )
        elif finding.status == "debt":
            print(
                f"DEBT: {finding.path} {finding.lines} lines > {finding.threshold} "
                f"(baseline {finding.baseline_lines}, {finding.limit_kind})"
            )
        else:
            print(
                f"{finding.severity.upper()}: {finding.path} "
                f"{finding.lines} lines > {finding.threshold} "
                f"({finding.limit_kind})"
            )


def failing_findings(
    findings: list[Finding],
    *,
    changed_only: bool,
    fail_on_warning: bool,
) -> list[Finding]:
    failures: list[Finding] = []
    for finding in findings:
        if finding.status == "debt":
            continue
        if finding.status == "ratchet":
            failures.append(finding)
            continue
        if finding.severity == "error":
            failures.append(finding)
        elif finding.severity == "warning" and (changed_only or fail_on_warning):
            failures.append(finding)
    return failures


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
        baseline = load_baseline(root)
        findings, scanned = check_files(root, args.changed_only, baseline)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    failures = failing_findings(
        findings,
        changed_only=args.changed_only,
        fail_on_warning=args.fail_on_warning,
    )
    active_errors = [
        finding
        for finding in findings
        if finding.status == "active" and finding.severity == "error"
    ]
    active_warnings = [
        finding
        for finding in findings
        if finding.status == "active" and finding.severity == "warning"
    ]
    debt = [finding for finding in findings if finding.status == "debt"]
    ratchets = [finding for finding in findings if finding.status == "ratchet"]

    if args.json:
        print(
            json.dumps(
                {
                    "scanned": scanned,
                    "active_warnings": len(active_warnings),
                    "active_errors": len(active_errors),
                    "legacy_debt": len(debt),
                    "ratchet_violations": len(ratchets),
                    "failures": len(failures),
                    "findings": [finding.__dict__ for finding in findings],
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print_human(findings, scanned)

    if failures:
        return EXIT_CHECK_FAILED
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
