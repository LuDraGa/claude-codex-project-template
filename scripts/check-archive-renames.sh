#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

ARCHIVE_DIR="execution_docs/archive"

if [ ! -d "$ARCHIVE_DIR" ]; then
  echo "Missing required directory: $ARCHIVE_DIR"
  exit 1
fi

pending_files=$(find "$ARCHIVE_DIR" -type f -name '*-to-be-renamed.md' | sort || true)

if [ -n "$pending_files" ]; then
  echo "Rename required: found archived files still using '*-to-be-renamed.md':"
  echo "$pending_files"
  echo "Rename these files to descriptive task names before push."
  exit 1
fi

echo "Archive rename check passed"
