#!/usr/bin/env sh
set -u

show_help() {
  cat <<'EOF'
Usage: scripts/hobit/validate.sh

Runs the standard Hobit validation sequence from the repository root.
Exit codes: 0 ok, 1 validation failed, 2 usage/environment error.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  show_help
  exit 0
fi

if [ "$#" -ne 0 ]; then
  echo "ERROR: unexpected arguments: $*" >&2
  show_help
  exit 2
fi

if [ ! -f "AGENTS.md" ] || [ ! -f "Cargo.toml" ]; then
  echo "ERROR: run this script from the Hobit repository root." >&2
  exit 2
fi

run_step() {
  name="$1"
  shift
  printf '\n==> %s\n' "$name"
  if ! "$@"; then
    echo "ERROR: step failed: $name" >&2
    exit 1
  fi
}

run_step "Frontend typecheck" npm run typecheck --prefix apps/desktop/frontend
run_step "Frontend production build" npm run build --prefix apps/desktop/frontend
run_step "Rust formatting" cargo fmt --all
run_step "Rust workspace check" cargo check --workspace
run_step "Rust workspace tests" cargo test --workspace
run_step "Hobit file size check" python scripts/hobit/check-file-sizes.py
run_step "Git whitespace check" git diff --check
run_step "Git status" git status --short --branch
