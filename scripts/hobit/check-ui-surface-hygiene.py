#!/usr/bin/env python3
"""Warn about frontend UI surface anti-patterns."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


EXIT_OK = 0
EXIT_CHECK_FAILED = 1
EXIT_USAGE_OR_ENVIRONMENT = 2

FRONTEND_SRC = Path("apps/desktop/frontend/src")
COMPONENTS_CSS = Path("apps/desktop/frontend/src/styles/components.css")
CONTRACTS = (
    "docs/FRONTEND_STRUCTURE_CONTRACT.md",
    "docs/UI_DESIGN_SYSTEM_CONTRACT.md",
    "docs/PRODUCT_UI_DESIGN_CONTRACT.md",
)
INLINE_ALLOW_TOKEN = "hobit-ui-hygiene:"
SOURCE_EXTENSIONS = {".ts", ".tsx"}
IGNORED_PARTS = {
    "__snapshots__",
    "debug",
    "diagnostics",
    "smoke",
}
VISIBLE_COPY_TERMS = (
    "Experimental",
    "Placeholder",
    "Coming soon",
    "Not wired here",
    "Frontend-only",
    "MVP",
    "Preview",
    "Executor",
)
STATIC_STATUS_TERMS = ("Queue", "Catalog", "Agent", "V2")
PLACEHOLDER_CONTROL_TERMS = (
    "coming soon",
    "filter",
    "placeholder",
    "search",
    "setting",
    "not wired",
)


@dataclass(frozen=True)
class AllowPattern:
    path: str
    rule: str
    pattern: str = ""


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    rule: str
    message: str
    excerpt: str


def repo_root() -> Path:
    root = Path.cwd()
    if not (root / "AGENTS.md").is_file() or not (root / "Cargo.toml").is_file():
        raise RuntimeError("run this script from the Hobit repository root")
    return root


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


def is_frontend_source(path: Path) -> bool:
    if path.suffix not in SOURCE_EXTENSIONS:
        return False
    if FRONTEND_SRC not in (Path(*path.parts[: len(FRONTEND_SRC.parts)]), path):
        return False
    if any(part in IGNORED_PARTS for part in path.parts):
        return False
    name = path.name
    return not (
        ".test." in name
        or ".spec." in name
        or name.endswith(".d.ts")
    )


def iter_source_files(root: Path, changed_only: bool) -> Iterable[Path]:
    if changed_only:
        candidates = changed_paths(root)
    else:
        candidates = (
            path.relative_to(root)
            for path in (root / FRONTEND_SRC).rglob("*")
            if path.is_file()
        )

    for path in sorted(candidates, key=lambda item: item.as_posix()):
        if is_frontend_source(path):
            yield path


def load_allowlist(root: Path, allowlist_path: Path | None) -> list[AllowPattern]:
    if allowlist_path is None:
        return []

    path = allowlist_path if allowlist_path.is_absolute() else root / allowlist_path
    if not path.is_file():
        raise RuntimeError(f"allowlist file not found: {allowlist_path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{allowlist_path} is not valid JSON: {error}") from error

    entries = data.get("allow")
    if not isinstance(entries, list):
        raise RuntimeError(f"{allowlist_path} must contain an 'allow' list")

    allowlist: list[AllowPattern] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise RuntimeError(f"{allowlist_path} contains an invalid allow entry")
        entry_path = entry.get("path")
        rule = entry.get("rule", "*")
        pattern = entry.get("pattern", "")
        if not isinstance(entry_path, str) or not isinstance(rule, str):
            raise RuntimeError(f"{allowlist_path} contains an invalid allow entry")
        if not isinstance(pattern, str):
            raise RuntimeError(f"{allowlist_path} contains an invalid allow pattern")
        allowlist.append(AllowPattern(path=entry_path, rule=rule, pattern=pattern))
    return allowlist


def strip_line_comment(line: str) -> str:
    marker = line.find("//")
    if marker == -1:
        return line
    return line[:marker]


def has_inline_allow(lines: list[str], index: int, rule: str) -> bool:
    candidates = [lines[index]]
    if index > 0:
        candidates.append(lines[index - 1])

    for line in candidates:
        marker = line.find(INLINE_ALLOW_TOKEN)
        if marker == -1:
            continue
        directive = line[marker + len(INLINE_ALLOW_TOKEN):].strip()
        if directive.startswith(("allow-file", "allow-next-line", "allow-line", "allow")):
            return rule in directive or "all" in directive or directive == "allow"
    return False


def is_allowed_by_config(path: Path, rule: str, line: str, allowlist: list[AllowPattern]) -> bool:
    normalized = path.as_posix()
    for entry in allowlist:
        if entry.rule not in {"*", rule}:
            continue
        if not fnmatch.fnmatch(normalized, entry.path):
            continue
        if entry.pattern and not re.search(entry.pattern, line):
            continue
        return True
    return False


def visible_text_contains(line: str, term: str) -> bool:
    escaped = re.escape(term)
    patterns = (
        rf">[^<{{}}]*\b{escaped}\b[^<{{}}]*<",
        rf"=\{{?\s*['\"`][^'\"`]*\b{escaped}\b[^'\"`]*['\"`]",
        rf"['\"`][^'\"`]*\b{escaped}\b[^'\"`]*['\"`]",
    )
    return any(re.search(pattern, line) for pattern in patterns)


def visible_copy_is_suspicious(line: str, term: str) -> bool:
    if not visible_text_contains(line, term):
        return False

    if term == "Preview":
        return bool(
            re.search(r">\s*Preview(?:\s+only)?\s*<", line)
            or re.search(r"['\"`]Preview(?:[- ]only| surface)?['\"`]", line)
        )

    if term == "Executor":
        return bool(
            re.search(r">\s*Executor\s*<", line)
            or re.search(r"['\"`]Executor['\"`]", line)
            or re.search(r"label=['\"`]Executor['\"`]", line)
        )

    return True


def add_finding(
    findings: list[Finding],
    *,
    path: Path,
    line_number: int,
    rule: str,
    message: str,
    excerpt: str,
    lines: list[str],
    allowlist: list[AllowPattern],
) -> None:
    if has_inline_allow(lines, line_number - 1, rule):
        return
    if is_allowed_by_config(path, rule, excerpt, allowlist):
        return
    findings.append(
        Finding(
            path=path.as_posix(),
            line=line_number,
            rule=rule,
            message=message,
            excerpt=excerpt.strip(),
        )
    )


def check_subtitle_usage(
    path: Path,
    lines: list[str],
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    in_shell = False
    start_line = 0
    for index, line in enumerate(lines):
        if re.search(r"<(WidgetFrame|WidgetV2Shell)\b", line):
            in_shell = True
            start_line = index + 1
        if in_shell and "subtitle=" in line:
            add_finding(
                findings,
                path=path,
                line_number=index + 1,
                rule="subtitle-prop",
                message=(
                    "WidgetFrame/WidgetV2Shell subtitle usage is suspicious; "
                    "use Title + InfoTip for explanatory copy."
                ),
                excerpt=line,
                lines=lines,
                allowlist=allowlist,
            )
        if in_shell and ">" in line and index + 1 > start_line:
            in_shell = False


def check_visible_copy(
    path: Path,
    lines: list[str],
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    if path.suffix != ".tsx":
        return
    for index, raw_line in enumerate(lines):
        line = strip_line_comment(raw_line)
        for term in VISIBLE_COPY_TERMS:
            if visible_copy_is_suspicious(line, term):
                add_finding(
                    findings,
                    path=path,
                    line_number=index + 1,
                    rule="visible-dev-copy",
                    message=(
                        f"Visible copy contains '{term}'. Confirm it is product copy "
                        "and not implementation/debug text."
                    ),
                    excerpt=raw_line,
                    lines=lines,
                    allowlist=allowlist,
                )


def check_static_status_labels(
    path: Path,
    lines: list[str],
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    if path.suffix != ".tsx":
        return
    for index, raw_line in enumerate(lines):
        line = strip_line_comment(raw_line)
        if not re.search(
            r"<Badge|StatusBadge|status-badge|badge|chip|kicker",
            line,
            re.IGNORECASE,
        ):
            continue
        for term in STATIC_STATUS_TERMS:
            if visible_text_contains(line, term):
                add_finding(
                    findings,
                    path=path,
                    line_number=index + 1,
                    rule="static-status-label",
                    message=(
                        f"'{term}' near badge/status markup may be a duplicate "
                        "or static status label. Status should reflect current state."
                    ),
                    excerpt=raw_line,
                    lines=lines,
                    allowlist=allowlist,
                )


def check_placeholder_controls(
    path: Path,
    lines: list[str],
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    if path.suffix != ".tsx":
        return

    index = 0
    while index < len(lines):
        line = lines[index]
        if not re.search(r"<(button|input|select|Button)\b", line):
            index += 1
            continue

        start = index
        collected = [line]
        while index < len(lines) - 1 and ">" not in lines[index]:
            index += 1
            collected.append(lines[index])

        block = "\n".join(collected)
        lowered = block.lower()
        has_static_disabled = bool(
            re.search(r"\bdisabled(\s|>|$)", block)
            or re.search(r"disabled=\{true\}", block)
        )
        has_placeholder_signal = any(term in lowered for term in PLACEHOLDER_CONTROL_TERMS)
        if has_static_disabled and has_placeholder_signal:
            add_finding(
                findings,
                path=path,
                line_number=start + 1,
                rule="placeholder-control",
                message=(
                    "Disabled control looks like a placeholder. Prefer omitting "
                    "future controls or showing an unavailable state with a reason."
                ),
                excerpt=block.splitlines()[0],
                lines=lines,
                allowlist=allowlist,
            )
        index += 1


def check_helper_exports(
    path: Path,
    lines: list[str],
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    parts = path.parts
    if "components" not in parts and "popups" not in parts:
        return
    if path.name == "index.ts":
        return

    expected = path.stem
    export_pattern = re.compile(
        r"^\s*export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)"
    )
    for index, raw_line in enumerate(lines):
        match = export_pattern.search(raw_line)
        if not match:
            continue
        exported_name = match.group(1)
        if exported_name == expected:
            continue
        add_finding(
            findings,
            path=path,
            line_number=index + 1,
            rule="component-helper-export",
            message=(
                f"Component/popup file exports helper '{exported_name}'. "
                "Shared helpers should live in model/domain modules."
            ),
            excerpt=raw_line,
            lines=lines,
            allowlist=allowlist,
        )


def git_added_lines(root: Path, path: Path) -> list[tuple[int, str]]:
    try:
        result = subprocess.run(
            ["git", "diff", "--unified=0", "--", path.as_posix()],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as error:
        raise RuntimeError(f"failed to run git: {error}") from error

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git diff failed")

    added: list[tuple[int, str]] = []
    new_line = 0
    for line in result.stdout.splitlines():
        hunk = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
        if hunk:
            new_line = int(hunk.group(1))
            continue
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added.append((new_line, line[1:]))
            new_line += 1
            continue
        if line.startswith("-"):
            continue
        if new_line:
            new_line += 1
    return added


def check_components_css_diff(
    root: Path,
    findings: list[Finding],
    allowlist: list[AllowPattern],
) -> None:
    path = COMPONENTS_CSS
    full_path = root / path
    if not full_path.is_file():
        return

    lines = full_path.read_text(encoding="utf-8", errors="replace").splitlines()
    for line_number, added_line in git_added_lines(root, path):
        stripped = added_line.strip()
        if not stripped or stripped.startswith(("/*", "*", "*/")):
            continue
        add_finding(
            findings,
            path=path,
            line_number=line_number,
            rule="components-css-addition",
            message=(
                "New styles in styles/components.css are suspicious; shared UI CSS "
                "belongs under styles/ui and widget-domain CSS under styles/widgets."
            ),
            excerpt=added_line,
            lines=lines,
            allowlist=allowlist,
        )


def check_files(
    root: Path,
    changed_only: bool,
    allowlist: list[AllowPattern],
) -> tuple[list[Finding], int]:
    findings: list[Finding] = []
    scanned = 0
    for path in iter_source_files(root, changed_only):
        scanned += 1
        lines = (root / path).read_text(encoding="utf-8", errors="replace").splitlines()
        check_subtitle_usage(path, lines, findings, allowlist)
        check_visible_copy(path, lines, findings, allowlist)
        check_static_status_labels(path, lines, findings, allowlist)
        check_placeholder_controls(path, lines, findings, allowlist)
        check_helper_exports(path, lines, findings, allowlist)

    check_components_css_diff(root, findings, allowlist)
    return findings, scanned


def print_human(findings: list[Finding], scanned: int) -> None:
    print(f"UI surface hygiene check scanned {scanned} frontend source files.")
    print("Mode: warnings only by default. Use --fail-on-warning to gate locally or in CI.")
    if not findings:
        print("No UI surface hygiene warnings.")
        return

    print(f"Warnings: {len(findings)}")
    print(f"Review contracts: {', '.join(CONTRACTS)}")
    print(
        "Allow an intentional exception with a nearby comment such as "
        "`// hobit-ui-hygiene: allow-line visible-dev-copy - reason`."
    )
    for finding in findings:
        print(
            f"WARNING {finding.rule}: {finding.path}:{finding.line}: "
            f"{finding.message}"
        )
        if finding.excerpt:
            print(f"  {finding.excerpt}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Warn about Hobit frontend UI surface hygiene anti-patterns."
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    parser.add_argument(
        "--changed-only",
        action="store_true",
        help="check only changed and untracked frontend source files",
    )
    parser.add_argument(
        "--fail-on-warning",
        action="store_true",
        help="return exit code 1 when warnings are present",
    )
    parser.add_argument(
        "--allowlist",
        type=Path,
        help="optional JSON allowlist with entries: {path, rule, pattern}",
    )
    args = parser.parse_args(argv)

    try:
        root = repo_root()
        allowlist = load_allowlist(root, args.allowlist)
        findings, scanned = check_files(root, args.changed_only, allowlist)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_ENVIRONMENT

    if args.json:
        print(
            json.dumps(
                {
                    "scanned": scanned,
                    "warnings": len(findings),
                    "findings": [finding.__dict__ for finding in findings],
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print_human(findings, scanned)

    if findings and args.fail_on_warning:
        return EXIT_CHECK_FAILED
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
