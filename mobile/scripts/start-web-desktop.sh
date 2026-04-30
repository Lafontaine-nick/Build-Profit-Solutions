#!/usr/bin/env bash
# Web (desktop browser) only — does NOT use --dev-client. Use for layout/UI work
# that should not depend on a native dev build. Native app still uses the same
# codebase; gate web-only behavior with Platform.OS === 'web' where needed.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1
export EXPO_NO_DOCTOR=1
exec npx expo start --web "$@"
