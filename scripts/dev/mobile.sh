#!/bin/bash
# SnazzyAI Mobile-First Startup Script
# Simplest path: backend + Metro + QR for physical device
# Usage:
#   ./scripts/dev/mobile.sh            # Start backend + frontend (Metro) minimal ports
#   ./scripts/dev/mobile.sh --android  # Also launch Android emulator/device inside container
#   ./scripts/dev/mobile.sh --ngrok    # Include ngrok profile (requires NGROK_AUTHTOKEN)
#   COMPOSE_PROFILES=mobile ./scripts/dev/mobile.sh  # Alternate way to include ngrok

set -euo pipefail

ANDROID_FLAG=false
NGROK_FLAG=false
NO_FOLLOW=false
for arg in "$@"; do
  case "$arg" in
    --android) ANDROID_FLAG=true ; shift ;;
    --ngrok) NGROK_FLAG=true ; shift ;;
    --no-follow) NO_FOLLOW=true ; shift ;;
    -h|--help)
      cat <<'EOF'
SnazzyAI Mobile Development

Purpose: Fast path to running the app on a physical mobile device.

USAGE:
  ./scripts/dev/mobile.sh [--android] [--ngrok] [--no-follow]

OPTIONS:
  --android     Attempt to start Expo with Android automatically (emulator or connected device)
  --ngrok       Start ngrok tunnel (backend) for off-LAN device testing (needs NGROK_AUTHTOKEN)
  --no-follow   Do not auto-follow frontend logs (manual `docker compose logs -f frontend`)

BEHAVIOR:
  - Detects host LAN IP and exports EXPO_PUBLIC_BACKEND_URL so device points correctly
  - Starts docker compose (backend + minimal Metro port 8081 only)
  - Auto-follows frontend logs to display Expo QR (unless --no-follow)
  - Shows health & common troubleshooting steps
EOF
      exit 0
      ;;
  esac
done

if [ ! -f .env.docker ]; then
  echo "❌ .env.docker missing. Run ./scripts/dev/bootstrap.sh first." >&2
  exit 1
fi

# Load UID/GID for permissions (avoid exporting readonly UID/GID in bash)
if [ -f .env.docker ]; then
  while IFS='=' read -r key value; do
    case $key in
      UID|GID)
        # Only export if variable not readonly (bash defines UID as readonly)
        if ! (readonly -p 2>/dev/null | grep -q " $key="); then
          export "$key"="${value}"
        fi
        ;;
    esac
  done < <(grep -E '^(UID|GID)=' .env.docker)
fi

# Detect first non-loopback IPv4 (best-effort)
HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++){if($i=="src"){print $(i+1);exit}}}')
if [[ -z "$HOST_IP" ]]; then
  HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [[ -z "$HOST_IP" ]]; then
  echo "⚠️  Could not auto-detect LAN IP. Set manually: export EXPO_PUBLIC_BACKEND_URL=http://<LAN-IP>:8000" >&2
else
  export EXPO_PUBLIC_BACKEND_URL="http://$HOST_IP:8000"
fi

# Compose profiles
COMPOSE_FILES="-f compose.yml"
if $NGROK_FLAG; then
  export COMPOSE_PROFILES="mobile"
fi

echo "🚀 Mobile-first startup"
echo "   Host LAN IP: ${HOST_IP:-unknown}"
echo "   EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL:-unset}"
echo "   Log follow: $([[ $NO_FOLLOW == false ]] && echo enabled || echo disabled)"

# Start compose (backend + frontend) minimal
( docker compose $COMPOSE_FILES up --build --remove-orphans ) &
COMPOSE_PID=$!

# Graceful shutdown
cleanup() {
  echo "\n🛑 Shutting down..."
  if [[ -n "${LOG_FOLLOW_PID:-}" ]]; then kill "$LOG_FOLLOW_PID" 2>/dev/null || true; fi
  docker compose $COMPOSE_FILES down
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait a bit for logs
sleep 6

if [[ $NO_FOLLOW == false ]]; then
  echo "--- ⏱  Following frontend logs for Expo QR (Ctrl+C to stop following, environment keeps running) ---" 
  # Follow logs in background to still show summary below if needed
  docker compose logs -f frontend &
  LOG_FOLLOW_PID=$!
fi

cat <<EOF
📱 SnazzyAI Mobile Dev Environment
---------------------------------
Backend API:       http://$HOST_IP:8000 (from device)
Health:            curl http://$HOST_IP:8000/api/health/
Metro status:      http://localhost:8081/status (from host)
API base (device): $EXPO_PUBLIC_BACKEND_URL

Next Steps:
  1. Watch frontend container logs for Expo QR code.
  2. Scan with Expo Go (same Wi-Fi) or run: npx expo start --tunnel (advanced).
  3. If QR fails, ensure phone can reach $HOST_IP:8000.

Android (optional):
  - Connect device via USB (enable debugging) or start an emulator.
  - Rerun with --android to auto attempt launch inside container.

Ngrok (optional):
  - Use --ngrok (and set NGROK_AUTHTOKEN) then use the tunnel host as backend URL if off-LAN.

Troubleshooting:
  - Device cannot load: verify same network & no VPN isolation.
  - Metro not ready: wait until /status returns {"status":"running"}.
  - Backend 404: confirm /api/health/ not /health/.
EOF

if $ANDROID_FLAG; then
  echo "📦 Launching Android inside frontend container..."
  docker compose exec -T frontend npx expo start --android || echo "⚠️ Android launch failed (no emulator/device?)."
fi

wait $COMPOSE_PID
