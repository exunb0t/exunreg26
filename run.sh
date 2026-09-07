#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
node scripts/exun.js
npx wrangler d1 migrations apply exunreg26 --local
exec npx wrangler dev --port 8788
