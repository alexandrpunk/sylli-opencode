#!/usr/bin/env bash
set -euo pipefail

echo "===================================================="
echo "          Sylli Healthcheck & Verification          "
echo "===================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${HOME}/.config/opencode"
OMO_CONFIG="${CONFIG_DIR}/oh-my-opencode-slim.json"
if [[ ! -f "$OMO_CONFIG" && -f "${CONFIG_DIR}/oh-my-opencode-slim.jsonc" ]]; then
  OMO_CONFIG="${CONFIG_DIR}/oh-my-opencode-slim.jsonc"
fi

ERRORS=0
WARNINGS=0

# 1. Check Node.js and Bun runtime
echo -n "[1/7] Checking runtime environments... "
RUNTIMES=""
if command -v node >/dev/null 2>&1; then
  RUNTIMES="Node $(node -v)"
fi
if command -v bun >/dev/null 2>&1; then
  RUNTIMES="${RUNTIMES:+$RUNTIMES, }Bun $(bun -v)"
fi

if [[ -n "$RUNTIMES" ]]; then
  echo "OK ($RUNTIMES)"
else
  echo "FAILED (neither node nor bun found)"
  ERRORS=$((ERRORS + 1))
fi

# 2. Check Sylli files
echo -n "[2/7] Verifying Sylli project files... "
REQUIRED_FILES=(
  "agents/sylli.md"
  "agents/goldfish-design_critic.md"
  "agents/goldfish-zoom_out.md"
  "agents/goldfish-implementation_readiness.md"
  "templates/DESIGN.template.md"
  "plugin/package.json"
  "plugin/src/index.ts"
  "SECURITY.md"
  "DESIGN.md"
)

MISSING_FILES=0
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "${PROJECT_DIR}/$f" ]]; then
    echo ""
    echo "  - Missing file: $f"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [[ $MISSING_FILES -eq 0 ]]; then
  echo "OK (All core files present)"
else
  ERRORS=$((ERRORS + 1))
fi

# 3. Check Plugin Dependencies
echo -n "[3/7] Checking plugin dependencies (node_modules)... "
if [[ -d "${PROJECT_DIR}/plugin/node_modules/@opencode-ai/plugin" ]]; then
  echo "OK (@opencode-ai/plugin installed)"
else
  echo "WARNING (run 'cd plugin && npm install' to bundle dependencies)"
  WARNINGS=$((WARNINGS + 1))
fi

# 4. Check Skills Catalog
echo -n "[4/7] Verifying skills catalog (~36 skills)... "
SKILL_COUNT=$(find "${PROJECT_DIR}/skills" -mindepth 1 -maxdepth 1 -type d | wc -l)
if [[ $SKILL_COUNT -ge 30 ]]; then
  echo "OK ($SKILL_COUNT skills detected)"
else
  echo "WARNING (Found only $SKILL_COUNT skills)"
  WARNINGS=$((WARNINGS + 1))
fi

# 5. Check Language Rules
echo -n "[5/7] Verifying stack rules... "
RULE_COUNT=$(find "${PROJECT_DIR}/rules" -maxdepth 1 -name "*.md" | wc -l)
if [[ $RULE_COUNT -ge 6 ]]; then
  echo "OK ($RULE_COUNT rule definitions present)"
else
  echo "WARNING (Found $RULE_COUNT rules)"
  WARNINGS=$((WARNINGS + 1))
fi

# 6. Check Linters and Formatters (for anti-slop gates)
echo -n "[6/7] Checking anti-slop gate tools... "
LINTERS_FOUND=()
for tool in prettier oxlint stylelint html-validate eslint ruff; do
  if command -v "$tool" >/dev/null 2>&1; then
    LINTERS_FOUND+=("$tool")
  fi
done

if [[ ${#LINTERS_FOUND[@]} -gt 0 ]]; then
  echo "OK (Available locally: ${LINTERS_FOUND[*]})"
else
  echo "NOTE (Linters available via npx/bunx on demand; run ./install.sh --with-linters for instant global access)"
fi

# 7. Check oh-my-opencode-slim configuration
echo -n "[7/7] Checking omo-slim configuration... "
if [[ -f "$OMO_CONFIG" ]]; then
  echo "OK ($OMO_CONFIG)"
  if grep -q "sylli" "$OMO_CONFIG" 2>/dev/null; then
    echo "  - Sylli is configured in omo-slim"
  else
    echo "  - Note: sylli is not yet registered in omo-slim (run ./install.sh to register)"
  fi
else
  echo "WARNING (omo-slim config not found at $OMO_CONFIG)"
  WARNINGS=$((WARNINGS + 1))
fi

echo "===================================================="
if [[ $ERRORS -eq 0 ]]; then
  echo "Result: PASS (0 errors, $WARNINGS warnings)"
  exit 0
else
  echo "Result: FAIL ($ERRORS errors, $WARNINGS warnings)"
  exit 1
fi
