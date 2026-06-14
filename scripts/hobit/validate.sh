#!/usr/bin/env sh
set -u

show_help() {
  cat <<'EOF'
Usage: scripts/hobit/validate.sh [--profile fast|changed|full]

Runs a Hobit validation profile from the repository root.
Use this wrapper for Unix/Linux development validation. It does not perform
Linux desktop UI smoke or packaging validation.

Profiles:
  fast     Quick iteration: frontend typecheck, cargo check, UI hygiene warnings, changed file sizes, git diff --check.
  changed  Git-changed-file based checks plus UI hygiene warnings, changed file sizes, and git diff --check.
  full     Full validation sequence. This is the default when no profile is passed.

Exit codes: 0 ok, 1 validation/check failed, 2 usage/environment error.
EOF
}

usage_error() {
  echo "ERROR: $1" >&2
  show_help
  exit 2
}

PROFILE="full"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      show_help
      exit 0
      ;;
    --profile)
      if [ "$#" -lt 2 ]; then
        usage_error "missing value for --profile."
      fi
      PROFILE="$2"
      shift 2
      ;;
    --profile=*)
      PROFILE="${1#--profile=}"
      shift
      ;;
    *)
      usage_error "unexpected arguments: $*"
      ;;
  esac
done

case "$PROFILE" in
  fast|changed|full) ;;
  *) usage_error "unknown validation profile '$PROFILE'. Expected one of: fast, changed, full." ;;
esac

if [ ! -f "AGENTS.md" ] || [ ! -f "Cargo.toml" ]; then
  echo "ERROR: run this script from the Hobit repository root." >&2
  exit 2
fi

test_python_candidate() {
  candidate="$1"
  if [ -z "$candidate" ]; then
    return 1
  fi
  "$candidate" --version >/dev/null 2>&1
}

resolve_python() {
  if [ "${HOBIT_PYTHON:-}" ] && test_python_candidate "$HOBIT_PYTHON"; then
    printf '%s\n' "$HOBIT_PYTHON"
    return 0
  fi

  for candidate in python3 python; do
    if test_python_candidate "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  echo "ERROR: Python was not found. Install Python or set HOBIT_PYTHON to a Python executable." >&2
  exit 2
}

PYTHON_CMD=$(resolve_python)
TOTAL_START=$("$PYTHON_CMD" -c 'import time; print(f"{time.monotonic():.6f}")')
TIMINGS=""

now_seconds() {
  "$PYTHON_CMD" -c 'import time; print(f"{time.monotonic():.6f}")'
}

duration_seconds() {
  "$PYTHON_CMD" -c 'import sys; print(f"{float(sys.argv[2]) - float(sys.argv[1]):.1f}")' "$1" "$2"
}

print_timing_summary() {
  total_end=$(now_seconds)
  total_duration=$(duration_seconds "$TOTAL_START" "$total_end")

  printf '\nStep timings:\n'
  if [ -z "$TIMINGS" ]; then
    printf '%s\n' "- none"
  else
    printf '%s' "$TIMINGS" | while IFS='|' read -r name seconds; do
      if [ -n "$name" ]; then
        printf -- '- %s: %ss\n' "$name" "$seconds"
      fi
    done
  fi
  printf 'Total: %ss\n' "$total_duration"
}

run_step() {
  name="$1"
  shift
  printf '\n==> %s\n' "$name"
  start=$(now_seconds)
  "$@"
  status=$?
  end=$(now_seconds)
  duration=$(duration_seconds "$start" "$end")
  TIMINGS="${TIMINGS}${name}|${duration}
"

  if [ "$status" -ne 0 ]; then
    echo "ERROR: step failed: $name" >&2
    print_timing_summary
    if [ "$status" -eq 126 ] || [ "$status" -eq 127 ]; then
      exit 2
    fi
    exit 1
  fi
}

ensure_frontend_dependencies() {
  if [ -d "apps/desktop/frontend/node_modules" ] &&
    { [ -f "apps/desktop/frontend/node_modules/.bin/tsc" ] ||
      [ -f "apps/desktop/frontend/node_modules/.bin/tsc.cmd" ]; }; then
    return 0
  fi

  echo "ERROR: Frontend dependencies are missing." >&2
  echo "Expected apps/desktop/frontend/node_modules with a local TypeScript compiler at node_modules/.bin/tsc." >&2
  echo "" >&2
  echo "Run:" >&2
  echo "  npm ci --prefix apps/desktop/frontend" >&2
  echo "" >&2
  echo "Then rerun:" >&2
  echo "  scripts/hobit/validate.sh --profile $PROFILE" >&2
  exit 2
}

is_ignored_path() {
  path="$1"
  case "$path" in
    *.zip|.git/*|*/.git/*|.vite/*|*/.vite/*|target/*|*/target/*|node_modules/*|*/node_modules/*|dist/*|*/dist/*|gen/*|*/gen/*)
      return 0
      ;;
  esac
  return 1
}

is_documentation_path() {
  path="$1"
  case "$path" in
    *.md|docs/*|decisions/*)
      return 0
      ;;
  esac
  return 1
}

is_rust_relevant_path() {
  path="$1"
  case "$path" in
    Cargo.toml|Cargo.lock|crates/*/Cargo.toml|apps/desktop/src-tauri/Cargo.toml)
      return 0
      ;;
  esac

  case "$path" in
    crates/*.rs|apps/desktop/src-tauri/*.rs)
      return 0
      ;;
  esac

  return 1
}

is_cargo_graph_path() {
  path="$1"
  case "$path" in
    Cargo.toml|Cargo.lock|*/Cargo.toml)
      return 0
      ;;
  esac
  return 1
}

package_for_path() {
  path="$1"
  case "$path" in
    crates/hobit-app/*) printf '%s\n' "hobit-app" ;;
    crates/hobit-storage-sqlite/*) printf '%s\n' "hobit-storage-sqlite" ;;
    crates/hobit-tools/*) printf '%s\n' "hobit-tools" ;;
    crates/hobit-core/*) printf '%s\n' "hobit-core" ;;
    crates/hobit-agent/*) printf '%s\n' "hobit-agent" ;;
    apps/desktop/src-tauri/*) printf '%s\n' "hobit-desktop" ;;
    *) printf '%s\n' "" ;;
  esac
}

add_package() {
  package="$1"
  if [ -z "$package" ]; then
    return 0
  fi

  case " $PACKAGES " in
    *" $package "*) return 0 ;;
  esac

  PACKAGES="$PACKAGES $package"
  PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
  SINGLE_PACKAGE="$package"
}

changed_files() {
  if ! diff_files=$(git diff --name-only HEAD --); then
    echo "ERROR: failed to inspect changed files with git diff." >&2
    exit 2
  fi
  if ! untracked_files=$(git ls-files --others --exclude-standard); then
    echo "ERROR: failed to inspect untracked files with git ls-files." >&2
    exit 2
  fi

  {
    printf '%s\n' "$diff_files"
    printf '%s\n' "$untracked_files"
  } | sort -u
}

run_fast_profile() {
  ensure_frontend_dependencies
  run_step "npm typecheck" npm run typecheck --prefix apps/desktop/frontend
  run_step "cargo check" cargo check --workspace
  run_step "ui surface hygiene changed-only" "$PYTHON_CMD" scripts/hobit/check-ui-surface-hygiene.py --changed-only
  run_step "check-file-sizes changed-only" "$PYTHON_CMD" scripts/hobit/check-file-sizes.py --changed-only
  run_step "git diff --check" git diff --check
}

run_changed_profile() {
  FRONTEND_CHANGED=0
  FRONTEND_SOURCE_OR_CONFIG_CHANGED=0
  RUST_CHANGED=0
  CARGO_GRAPH_CHANGED=0
  PACKAGES=""
  PACKAGE_COUNT=0
  SINGLE_PACKAGE=""
  CONSIDERED_COUNT=0

  files=$(changed_files)
  while IFS= read -r path; do
    if [ -z "$path" ] || is_ignored_path "$path"; then
      continue
    fi

    CONSIDERED_COUNT=$((CONSIDERED_COUNT + 1))

    case "$path" in
      apps/desktop/frontend/*)
        FRONTEND_CHANGED=1
        if ! is_documentation_path "$path"; then
          FRONTEND_SOURCE_OR_CONFIG_CHANGED=1
        fi
        ;;
    esac

    if is_rust_relevant_path "$path"; then
      RUST_CHANGED=1
      if is_cargo_graph_path "$path"; then
        CARGO_GRAPH_CHANGED=1
      fi
      add_package "$(package_for_path "$path")"
    fi
  done <<EOF
$files
EOF

  printf 'Changed profile considered %s changed file(s) after Toolbelt ignores.\n' "$CONSIDERED_COUNT"

  if [ "$FRONTEND_CHANGED" -eq 1 ]; then
    ensure_frontend_dependencies
    run_step "npm typecheck" npm run typecheck --prefix apps/desktop/frontend
  fi
  if [ "$FRONTEND_SOURCE_OR_CONFIG_CHANGED" -eq 1 ]; then
    ensure_frontend_dependencies
    run_step "npm build" npm run build --prefix apps/desktop/frontend
  fi

  if [ "$RUST_CHANGED" -eq 1 ]; then
    run_step "cargo check" cargo check --workspace
    if [ "$CARGO_GRAPH_CHANGED" -eq 1 ] || [ "$PACKAGE_COUNT" -ne 1 ]; then
      run_step "cargo test workspace" cargo test --workspace
    else
      run_step "cargo test -p $SINGLE_PACKAGE" cargo test -p "$SINGLE_PACKAGE"
    fi
  fi

  run_step "ui surface hygiene changed-only" "$PYTHON_CMD" scripts/hobit/check-ui-surface-hygiene.py --changed-only
  run_step "check-file-sizes changed-only" "$PYTHON_CMD" scripts/hobit/check-file-sizes.py --changed-only
  run_step "git diff --check" git diff --check
}

run_full_profile() {
  ensure_frontend_dependencies
  run_step "npm typecheck" npm run typecheck --prefix apps/desktop/frontend
  run_step "npm build" npm run build --prefix apps/desktop/frontend
  run_step "cargo fmt" cargo fmt --all
  run_step "cargo check" cargo check --workspace
  run_step "cargo test workspace" cargo test --workspace
  run_step "ui surface hygiene" "$PYTHON_CMD" scripts/hobit/check-ui-surface-hygiene.py
  run_step "check-file-sizes" "$PYTHON_CMD" scripts/hobit/check-file-sizes.py
  run_step "git diff --check" git diff --check
  run_step "git status" git status --short --branch
}

printf 'Hobit validation profile: %s\n' "$PROFILE"

case "$PROFILE" in
  fast) run_fast_profile ;;
  changed) run_changed_profile ;;
  full) run_full_profile ;;
esac

print_timing_summary
exit 0
