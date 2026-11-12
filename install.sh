#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/install.js" "$@"

if [[ ! " $* " =~ " --uninstall " && ! " $* " =~ " --dry-run " ]]; then
  echo ""
  "${SCRIPT_DIR}/verify.sh"
fi
