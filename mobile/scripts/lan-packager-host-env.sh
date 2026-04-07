#!/usr/bin/env bash
# Source from mobile/: sets REACT_NATIVE_PACKAGER_HOSTNAME for Expo LAN / Metro.
# Fixes wrong QR URLs when Expo picks a bridge/VPN interface instead of Wi‑Fi.

set -e

pick_ip() {
  local iface ip
  iface=$(route -n get default 2>/dev/null | awk '/interface: / { print $2 }')
  if [[ -n "${iface:-}" ]]; then
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
      echo "$ip"
      return 0
    fi
  fi
  local i
  for i in 0 1 2 3 4 5 6 7 8 9; do
    ip=$(ipconfig getifaddr "en$i" 2>/dev/null || true)
    [[ -z "$ip" ]] && continue
    case "$ip" in
      192.168.*|10.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*)
        echo "$ip"
        return 0
        ;;
    esac
  done
  return 1
}

if ! IP=$(pick_ip); then
  echo "lan-packager-host-env: could not detect a private LAN IP." >&2
  echo "  Set: export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x  then: npx expo start --lan" >&2
  exit 1
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$IP"
echo ">>> LAN packager host: $REACT_NATIVE_PACKAGER_HOSTNAME (REACT_NATIVE_PACKAGER_HOSTNAME)" >&2
echo ">>> Test from iPhone Safari: http://${REACT_NATIVE_PACKAGER_HOSTNAME}:8081" >&2
