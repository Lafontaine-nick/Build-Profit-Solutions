#!/usr/bin/env bash
# Clear Metro / Expo caches so Babel + runtime versions match after dependency changes.
# Run from anywhere via: npm run metro:clean (from mobile/) or bash scripts/metro-clean.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/package.json" ]]; then
  echo "error: expected package.json at $ROOT" >&2
  exit 1
fi
cd "$ROOT" || exit 1

echo "Clearing caches in: $ROOT"

rm -rf node_modules/.cache .expo .expo-shared .metro-cache

# Metro temp dirs (same idea as scripts/expo-reset.sh)
if [[ -n "${TMPDIR:-}" ]]; then
  rm -rf "${TMPDIR}/metro-"* "${TMPDIR}/haste-map-"* 2>/dev/null || true
fi
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all 2>/dev/null || true
else
  echo "(watchman not installed — skipped)"
fi

echo ""
echo "Done. Restart Metro with a full reset, for example:"
echo "  npx expo start --clear"
echo "  npx expo start --web --clear"
echo "  npx expo start --dev-client --lan --clear"
