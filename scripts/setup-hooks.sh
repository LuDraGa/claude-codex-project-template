#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository"
  exit 1
fi

git config core.hooksPath .husky/_
chmod +x .husky/pre-commit .husky/pre-push .husky/post-commit

echo "Git hooks configured: core.hooksPath=.husky/_"
