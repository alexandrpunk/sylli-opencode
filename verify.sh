#!/usr/bin/env bash
set -euo pipefail

echo "===================================================="
echo "          Sylli Healthcheck & Verification          "
echo "===================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${HOME}/.config/opencode"
OPENCODE_CONFIG="${CONFIG_DIR}/opencode.json"
OMO_CONFIG="${CONFIG_DIR}/oh-my-opencode-slim.json"
if [[ ! -f "$OMO_CONFIG" && -f "${CONFIG_DIR}/oh-my-opencode-slim.jsonc" ]]; then
  OMO_CONFIG="${CONFIG_DIR}/oh-my-opencode-slim.jsonc"
fi

ERRORS=0
WARNINGS=0

# Release metadata must stay synchronized between the package manifest and lockfile.
echo -n "[release] Checking local plugin version... "
if [[ -f "${PROJECT_DIR}/plugin/package.json" && -f "${PROJECT_DIR}/plugin/package-lock.json" ]] && command -v node >/dev/null 2>&1; then
  LOCAL_VERSION=$(node -p "require('${PROJECT_DIR}/plugin/package.json').version")
  LOCK_VERSION=$(node -p "require('${PROJECT_DIR}/plugin/package-lock.json').version")
  ROOT_LOCK_VERSION=$(node -p "require('${PROJECT_DIR}/plugin/package-lock.json').packages[''].version")
  if [[ "$LOCAL_VERSION" == "0.4.0" && "$LOCAL_VERSION" == "$LOCK_VERSION" && "$LOCAL_VERSION" == "$ROOT_LOCK_VERSION" ]]; then
    echo "OK (release $LOCAL_VERSION; package and lockfile agree)"
  else
    echo "FAILED (package=$LOCAL_VERSION lockfile=$LOCK_VERSION root-lock=$ROOT_LOCK_VERSION; expected 0.4.0)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "FAILED (package manifests or node unavailable)"
  ERRORS=$((ERRORS + 1))
fi

# 1. Check Node.js and Bun runtime
echo -n "[1/9] Checking runtime environments... "
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
echo -n "[2/9] Verifying Sylli project files... "
REQUIRED_FILES=(
  "agents/sylli.md"
  "agents/goldfish-design_critic.md"
  "agents/goldfish-zoom_out.md"
  "agents/goldfish-implementation_readiness.md"
  "templates/DESIGN.template.md"
  "plugin/package.json"
  "plugin/src/index.ts"
  "plugin/src/memory-hygiene.ts"
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

# 3. Verify vendored Taste Skill and deployment
printf '[3/9] Verifying vendored Taste Skill... '
TASTE_MANIFEST="${PROJECT_DIR}/vendor/UPSTREAM.json"
TASTE_SKILL_FILE="${PROJECT_DIR}/skills/taste-skill/SKILL.md"
EXPECTED_TASTE_COMMIT='d1a2bb41d927083ac7118f60cfc9cdf711810ea0'
if [[ -f "$TASTE_MANIFEST" ]] && grep -q '"commit": "'"$EXPECTED_TASTE_COMMIT"'"' "$TASTE_MANIFEST" \
  && grep -q '"skillName": "design-taste-frontend"' "$TASTE_MANIFEST" \
  && [[ -f "$TASTE_SKILL_FILE" ]] && grep -q '^name: design-taste-frontend$' "$TASTE_SKILL_FILE"; then
  echo "OK (design-taste-frontend; upstream commit ${EXPECTED_TASTE_COMMIT})"
  if [[ -f "${HOME}/.config/opencode/skills/taste-skill/SKILL.md" ]]; then
    echo "  - Deployed copy present in ${HOME}/.config/opencode/skills/taste-skill"
  else
    echo "  - NOTE: not deployed yet (run ./install.sh)"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "FAILED (missing SKILL.md or unexpected frontmatter name)"
  ERRORS=$((ERRORS + 1))
fi

# 4. Check Plugin Dependencies
echo -n "[4/9] Checking plugin dependencies... "
if grep -q '"@opencode/plugin"' "${PROJECT_DIR}/plugin/package.json"; then
  echo "OK (@opencode/plugin declared; runtime provided by OpenCode)"
else
  echo "WARNING (plugin must declare @opencode/plugin)"
  WARNINGS=$((WARNINGS + 1))
fi

# 4. Check Skills Catalog
echo -n "[5/9] Verifying skills catalog (~37 skills)... "
SKILL_COUNT=$(find "${PROJECT_DIR}/skills" -mindepth 1 -maxdepth 1 -type d | wc -l)
if [[ $SKILL_COUNT -ge 30 ]]; then
  echo "OK ($SKILL_COUNT skills detected)"
else
  echo "WARNING (Found only $SKILL_COUNT skills)"
  WARNINGS=$((WARNINGS + 1))
fi

# 5. Check Language Rules
echo -n "[6/9] Verifying stack rules... "
RULE_COUNT=$(find "${PROJECT_DIR}/rules" -maxdepth 1 -name "*.md" | wc -l)
if [[ $RULE_COUNT -ge 6 ]]; then
  echo "OK ($RULE_COUNT rule definitions present)"
else
  echo "WARNING (Found $RULE_COUNT rules)"
  WARNINGS=$((WARNINGS + 1))
fi

# 6. Check Linters and Formatters (for anti-slop gates)
echo -n "[7/9] Checking anti-slop gate tools... "
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
echo -n "[8/9] Checking omo-slim configuration... "
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

# 8. Check project memory plugin registration (install.sh adds it)
echo -n "[9/9] Checking project memory plugin registration... "
if [[ -f "$OPENCODE_CONFIG" ]] && grep -q "@knikolov/opencode-plugin-simple-memory" "$OPENCODE_CONFIG" 2>/dev/null; then
  echo "OK (@knikolov/opencode-plugin-simple-memory registered)"
else
  echo "WARNING (memory plugin not registered; run ./install.sh to enable automatic project memory)"
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
