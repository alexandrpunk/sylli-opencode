#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE="origin"
FORCE=0
MODE=""
TAG=""

usage() {
  cat <<'EOF'
Usage:
  ./update.sh --check [--force]
  ./update.sh --tag VERSION [--force]

--check       Explicitly fetch tags from origin and show newer tags/commits.
--tag VERSION Show the selected tag and its commits; never checks out or installs.
--force       Allow the inspection when the working tree is dirty.

This helper never downloads or executes project code automatically. Install a
selected release manually, then run ./install.sh --dry-run and ./verify.sh.
EOF
}

while (($#)); do
  case "$1" in
    --check) MODE="check" ;;
    --tag)
      [[ $# -ge 2 ]] || { echo "--tag requires VERSION" >&2; exit 2; }
      MODE="tag"; TAG="$2"; shift
      ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

[[ -n "$MODE" ]] || { usage >&2; exit 2; }
cd "$SCRIPT_DIR"

if [[ $FORCE -eq 0 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to inspect updates: git tree is dirty. Commit/stash changes or pass --force." >&2
  exit 1
fi

git remote get-url "$REMOTE" >/dev/null

if [[ "$MODE" == "check" ]]; then
  echo "Fetching tags from $REMOTE (explicit action requested)..."
  git fetch --tags "$REMOTE"
  CURRENT=$(node -p "require('./plugin/package.json').version")
  echo "Local plugin version: $CURRENT"
  echo "Available release tags:"
  git tag --list 'v*' --sort=-version:refname | head -20
  echo "Commits available on $REMOTE/main beyond local HEAD:"
  git log --oneline HEAD.."$REMOTE/main" 2>/dev/null || echo "  (remote main is unavailable or has no new commits)"
  echo "No files were changed; no code was downloaded or executed."
  exit 0
fi

[[ "$TAG" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION must be semantic version, e.g. 0.4.0 or v0.4.0" >&2; exit 2; }
TAG="v${TAG#v}"
git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null || {
  echo "Tag $TAG is not available locally. Run ./update.sh --check first." >&2
  exit 1
}
echo "Selected release: $TAG ($(git rev-list -n 1 "$TAG"))"
git show --no-patch --format='  %h %s (%ad)' --date=short "$TAG"
echo "Recent release commits:"
git log --oneline -10 "$TAG"
echo
echo "No checkout or installation performed. To apply manually after reviewing the tag:"
echo "  git checkout --detach $TAG   # only with a clean tree and explicit confirmation"
echo "  ./install.sh --dry-run"
echo "  ./install.sh"
echo "  ./verify.sh"
