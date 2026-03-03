# CODE_SEARCH.md

Guide for finding code with modern tools.

## Preferred Tools

- `rg` (ripgrep): fast text search across code.
- `ast-grep`: structural/AST-aware search and refactor targeting.

Do not default to plain `grep` when `rg` is available.

## Install

```bash
# ripgrep
brew install ripgrep

# ast-grep
npm install -g @ast-grep/cli
```

## ripgrep Quick Patterns

```bash
# Text search
rg "pattern"

# Restrict file types
rg "pattern" --type ts --type tsx

# List matched files only
rg -l "pattern"

# Show context
rg "pattern" -C 3

# Exclude paths
rg "pattern" --glob '!dist/*' --glob '!node_modules/*'
```

## ast-grep Quick Patterns

```bash
# Generic function call pattern
ast-grep --pattern '$FUNC($$$)'

# Async arrow function assignment
ast-grep --pattern 'const $NAME = async ($$$) => { $$$ }'

# try/catch blocks
ast-grep --pattern 'try { $$$ } catch ($ERR) { $$$ }'

# Structural refactor discovery across TSX
ast-grep --lang tsx --pattern 'useEffect($$$)'
```

## Combined Workflow

```bash
# 1) Narrow files with rg
rg -l "target_symbol" src/

# 2) Inspect structure with ast-grep
rg -l "target_symbol" src/ | xargs ast-grep --pattern '$FUNC($$$)'
```

## Usage Guidance

- Start with `rg` to quickly find candidate files.
- Use `ast-grep` when regex is fragile or structure matters.
- Keep patterns small first, then refine with placeholders.
