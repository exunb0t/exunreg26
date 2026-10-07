#!/bin/zsh
set -euo pipefail
pkill -f "wrangler dev" || true
lsof -ti tcp:8788 | xargs kill -9 2>/dev/null || true
