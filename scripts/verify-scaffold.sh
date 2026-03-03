#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

required_files="
CLAUDE.md
AGENTS.md
docs/SYSTEM_LANDSCAPE.md
docs/DOMAIN_LOGIC.md
docs/DATA_DICTIONARY.md
docs/INFRASTRUCTURE.md
docs/SECURITY_ADVISORY.md
docs/ENGINEERING_STANDARDS.md
docs/CODE_SEARCH.md
docs/INTEGRATION_CONTRACTS.md
docs/OPERATIONAL_PLAYBOOK.md
docs/DECISION_LOG/README.md
docs/DECISION_LOG/0000-template.md
execution_docs/_active/planning.md
execution_docs/_active/execution.md
scripts/check-archive-renames.sh
scripts/setup-hooks.sh
.github/workflows/scaffold-ci.yml
.github/workflows/deploy-template.yml
.husky/pre-push
"

missing=0
for file in $required_files; do
  if [ ! -s "$file" ]; then
    echo "Missing or empty required file: $file"
    missing=1
  fi
done

if [ ! -d "execution_docs/archive" ]; then
  echo "Missing required directory: execution_docs/archive"
  missing=1
fi

if ! grep -q "^## Agent Rules" CLAUDE.md; then
  echo "CLAUDE.md must include an Agent Rules section"
  missing=1
fi

if ! grep -q "^## Agent Rules" AGENTS.md; then
  echo "AGENTS.md must include an Agent Rules section"
  missing=1
fi

if ! grep -q "docs/DOMAIN_LOGIC.md" AGENTS.md; then
  echo "AGENTS.md must link docs/DOMAIN_LOGIC.md"
  missing=1
fi

if ! grep -q "execution_docs/_active/planning.md" CLAUDE.md; then
  echo "CLAUDE.md must reference execution_docs/_active/planning.md"
  missing=1
fi

if ! grep -q "docs/CODE_SEARCH.md" CLAUDE.md; then
  echo "CLAUDE.md must reference docs/CODE_SEARCH.md"
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo "Scaffold verification failed"
  exit 1
fi

echo "Scaffold verification passed"
