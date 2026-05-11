#!/usr/bin/env python3
"""Print a compact Hobit directory/module map with line counts."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path


EXIT_OK = 0
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
TEXT_EXTENSIONS = {
    ".rs",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".ps1",
    ".sh",
    ".md",
    ".toml",
    ".json",
    ".css",
    ".html",
}


@dataclass
class Node:
    name: str
    path: str
    kind: str
    lines: int = 0
    files: int = 0
    children: list["Node"] = field(default_factory=list)

    def to_json(self) -> dict[str, object]:
        return {
            "name": self.name,
            "path": self.path,
            "kind": self.kind,
            "lines": self.lines,
            "files": self.files,
            "children": [child.to_json() for child in self.children],
        }


def repo_root() -> Path:
    root = Path.cwd()
    if not (root / "AGENTS.md").is_file() or not (root / "Cargo.toml").is_file():
        raise RuntimeError("run this script from the Hobit repository root")
    return root


def is_ignored(path: Path) -> bool:
    if path.name.endswith(".zip"):
        return True
    if any(part in IGNORED_DIRS for part in path.parts):
        return True
    return any(path == ignored or ignored in path.parents for ignored in IGNORED_PATHS)


def is_text_file(path: Path) -> bool:
    return path.suffix in TEXT_EXTENSIONS and not is_ignored(path)


def line_count(path: Path) -> int:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        return sum(1 for _ in handle)


def build_node(root: Path, relative_path: Path, max_depth: int, depth: int) -> Node | None:
    absolute_path = root / relative_path
    if is_ignored(relative_path):
        return None

    if absolute_path.is_file():
        if not is_text_file(relative_path):
            return None
        lines = line_count(absolute_path)
        return Node(
            name=relative_path.name,
            path=relative_path.as_posix(),
            kind="file",
            lines=lines,
            files=1,
        )

    if not absolute_path.is_dir():
        return None

    node = Node(
        name=relative_path.name or ".",
        path=relative_path.as_posix() or ".",
        kind="directory",
    )

    if depth < max_depth:
        children: list[Node] = []
        for child in sorted(absolute_path.iterdir(), key=lambda item: item.name.lower()):
            child_relative = child.relative_to(root)
            child_node = build_node(root, child_relative, max_depth, depth + 1)
            if child_node is not None:
                children.append(child_node)
        node.children = children

    totals = directory_totals(root, relative_path)
    node.lines = totals.lines
    node.files = totals.files
    return node


@dataclass(frozen=True)
class Totals:
    lines: int
    files: int


def directory_totals(root: Path, relative_path: Path) -> Totals:
    absolute_path = root / relative_path
    lines = 0
    files = 0
    for path in absolute_path.rglob("*"):
        if not path.is_file():
            continue
        child_relative = path.relative_to(root)
        if not is_text_file(child_relative):
            continue
        files += 1
        lines += line_count(path)
    return Totals(lines=lines, files=files)


def print_human(node: Node, indent: str = "") -> None:
    suffix = "/" if node.kind == "directory" else ""
    print(f"{indent}{node.name}{suffix} ({node.files} files, {node.lines} lines)")
    for child in node.children:
        print_human(child, indent + "  ")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Print a compact Hobit directory/module map with line counts."
    )
    parser.add_argument(
        "--path",
        default=".",
        help="repository-relative path to map, default: repository root",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=2,
        help="maximum directory depth to print, default: 2",
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args(argv)

    if args.max_depth < 0:
        print("ERROR: --max-depth must be non-negative", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    try:
        root = repo_root()
        relative_path = Path(args.path)
        target = root / relative_path
        if not target.exists():
            raise RuntimeError(f"path does not exist: {relative_path.as_posix()}")
        node = build_node(root, relative_path, args.max_depth, 0)
        if node is None:
            raise RuntimeError(f"path has no mappable source files: {relative_path.as_posix()}")
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    if args.json:
        print(json.dumps(node.to_json(), indent=2, sort_keys=True))
    else:
        print_human(node)
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
