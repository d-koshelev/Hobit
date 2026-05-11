#!/usr/bin/env python3
"""Summarize changed Hobit files by area with validation hints."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


EXIT_OK = 0
EXIT_USAGE_OR_ENVIRONMENT = 2

AREAS = [
    "frontend",
    "app service",
    "storage",
    "core",
    "tools",
    "tauri",
    "docs",
    "scripts",
    "tests",
    "other",
]
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


@dataclass
class ChangedFile:
    path: str
    status: str


@dataclass
class AreaSummary:
    area: str
    files: list[ChangedFile] = field(default_factory=list)


def repo_root() -> Path:
    root = Path.cwd()
    if not (root / "AGENTS.md").is_file() or not (root / "Cargo.toml").is_file():
        raise RuntimeError("run this script from the Hobit repository root")
    return root


def git_status(root: Path) -> list[ChangedFile]:
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain=v1", "--untracked-files=all"],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as error:
        raise RuntimeError(f"failed to run git: {error}") from error

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git status failed")

    files: list[ChangedFile] = []
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        status = line[:2]
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        path = path.strip('"')
        if is_ignored_path(path):
            continue
        files.append(ChangedFile(path=path, status=status.strip() or "modified"))
    return sorted(files, key=lambda item: item.path)


def is_ignored_path(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if normalized.endswith(".zip"):
        return True

    relative = Path(normalized)
    if any(part in IGNORED_DIRS for part in relative.parts):
        return True

    return any(relative == ignored or ignored in relative.parents for ignored in IGNORED_PATHS)


def classify(path: str) -> str:
    normalized = path.replace("\\", "/")
    name = normalized.rsplit("/", 1)[-1]
    if (
        "/tests/" in normalized
        or name == "tests.rs"
        or name.endswith(".test.ts")
        or name.endswith(".test.tsx")
        or name.endswith(".spec.ts")
        or name.endswith(".spec.tsx")
    ):
        return "tests"
    if normalized.startswith("apps/desktop/frontend/"):
        return "frontend"
    if normalized.startswith("apps/desktop/src-tauri/"):
        return "tauri"
    if normalized.startswith("crates/hobit-app/"):
        return "app service"
    if normalized.startswith("crates/hobit-storage-sqlite/"):
        return "storage"
    if normalized.startswith("crates/hobit-core/"):
        return "core"
    if normalized.startswith("crates/hobit-tools/"):
        return "tools"
    if normalized.startswith("scripts/"):
        return "scripts"
    if (
        normalized.startswith("docs/")
        or normalized.startswith("decisions/")
        or normalized in {"AGENTS.md", "README.md", "ROADMAP.md"}
    ):
        return "docs"
    return "other"


def impact_hint(area: str) -> str:
    hints = {
        "frontend": "Frontend API or UI files changed.",
        "app service": "Workspace application orchestration changed.",
        "storage": "SQLite storage primitives changed.",
        "core": "Core domain contracts changed.",
        "tools": "Tool adapter code changed.",
        "tauri": "Desktop bridge or Tauri shell changed.",
        "docs": "Project contracts or documentation changed.",
        "scripts": "Repository tooling changed.",
        "tests": "Test coverage changed.",
        "other": "Miscellaneous repository files changed.",
    }
    return hints[area]


def suggested_validation(areas: set[str]) -> list[str]:
    commands: list[str] = []
    if areas & {"frontend"}:
        commands.extend(
            [
                "npm.cmd run typecheck --prefix apps/desktop/frontend",
                "npm.cmd run build --prefix apps/desktop/frontend",
            ]
        )
    if areas & {"app service", "storage", "core", "tools", "tauri", "tests"}:
        commands.extend(
            [
                "cargo fmt --all",
                "cargo check --workspace",
                "cargo test --workspace",
            ]
        )
    if areas & {"scripts", "docs", "other"}:
        commands.extend(
            [
                "python scripts/hobit/check-file-sizes.py",
                "git diff --check",
            ]
        )
    if not commands:
        commands.append("git status --short --branch")

    seen: set[str] = set()
    unique: list[str] = []
    for command in commands:
        if command not in seen:
            unique.append(command)
            seen.add(command)
    return unique


def summarize(files: list[ChangedFile]) -> list[AreaSummary]:
    grouped = {area: AreaSummary(area=area) for area in AREAS}
    for changed_file in files:
        grouped[classify(changed_file.path)].files.append(changed_file)
    return [grouped[area] for area in AREAS if grouped[area].files]


def print_human(summaries: list[AreaSummary], validation: list[str]) -> None:
    if not summaries:
        print("No changed files.")
        print("Suggested validation:")
        print("- git status --short --branch")
        return

    print("Changed files by area:")
    for summary in summaries:
        print(f"\n{summary.area}: {impact_hint(summary.area)}")
        for changed_file in summary.files:
            print(f"  {changed_file.status:2} {changed_file.path}")

    print("\nSuggested validation:")
    for command in validation:
        print(f"- {command}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Summarize changed Hobit files by area with validation hints."
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args(argv)

    try:
        root = repo_root()
        files = git_status(root)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    summaries = summarize(files)
    areas = {summary.area for summary in summaries}
    validation = suggested_validation(areas)

    if args.json:
        print(
            json.dumps(
                {
                    "areas": [
                        {
                            "area": summary.area,
                            "impact": impact_hint(summary.area),
                            "files": [changed_file.__dict__ for changed_file in summary.files],
                        }
                        for summary in summaries
                    ],
                    "suggested_validation": validation,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print_human(summaries, validation)
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
