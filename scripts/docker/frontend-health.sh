#!/usr/bin/env bash
set -euo pipefail

# Frontend healthcheck for Expo/Metro inside container.
# Success criteria (any one passes):
# 1. Metro status endpoint responds 200 (port 8081 /status)
# 2. Expo DevTools root (19000) responds 200/301
# 3. Node process running with expo CLI command and ports listening

metro_status() {
  curl -fsS http://localhost:8081/status >/dev/null 2>&1
}

devtools_status() {
  code=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:19000/ || true)
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
    return 0
  fi
  return 1
}

node_process() {
  pgrep -f "node .*expo" >/dev/null 2>&1 || pgrep -f "expo start" >/dev/null 2>&1
}

port_listening() {
  # Check if expected ports are in LISTEN (8081 or 19000)
  ss -ltn 2>/dev/null | grep -E ':(8081|19000) ' >/dev/null 2>&1
}

if metro_status || devtools_status || { node_process && port_listening; }; then
  echo "healthy"
  exit 0
fi

echo "starting"
exit 1
