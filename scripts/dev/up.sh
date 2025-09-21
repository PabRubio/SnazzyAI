#!/bin/bash
# SnazzyAI Docker Development Environment Startup Script
# Usage: ./scripts/dev/up.sh [host|--help]

set -e  # Exit on any error

# Help text
show_help() {
    cat << 'EOF'
SnazzyAI Docker Development Environment

USAGE:
    ./scripts/dev/up.sh                 Start with normal port mapping (default)
    ./scripts/dev/up.sh host            Start with host networking (Linux only)
    ./scripts/dev/up.sh --help          Show this help

MODES:
    Normal (default):
        Uses Docker port mapping. Works on all systems.
        Good for web browsers, emulators, and most mobile device testing.

    Host networking:
        Linux only (Ubuntu 22/24). Uses host network directly.
        Better for physical device discovery if port mapping has issues.

SERVICES:
    Frontend:  React Native/Expo dev server with hot reload
    Backend:   Django API server with auto-reload
    ngrok:     Optional tunnel for mobile testing (use --profile mobile)

EXAMPLES:
    # Standard development (most common)
    ./scripts/dev/up.sh

    # Host networking for better device discovery (Linux only)
    ./scripts/dev/up.sh host

    # Include ngrok for mobile testing
    docker compose --profile mobile up --build

PORTS (normal mode):
    8000     Backend Django API
    19000    Expo DevTools (open in browser)
    19001    Expo bundler/packager
    19002    Expo development tools
    8081     Metro bundler

ACCESS:
    Backend API:       http://localhost:8000
    Expo DevTools:     http://localhost:19000
    Mobile App:        Scan QR code in Expo DevTools
EOF
}

# Parse arguments
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Check if .env.docker exists (should be created by bootstrap.sh)
if [ ! -f .env.docker ]; then
    echo "❌ .env.docker not found. Please run bootstrap first:"
    echo "   ./scripts/dev/bootstrap.sh"
    exit 1
fi

# Load user ID/GID for container permissions safely (avoid readonly var errors)
if [ -f .env.docker ]; then
  while IFS='=' read -r key value; do
    case $key in
      UID|GID)
        # Only export if variable not already readonly in environment
        if ! (readonly -p 2>/dev/null | grep -q " $key="); then
          export "$key"="${value}"
        fi
        ;;
    esac
  done < <(grep -E '^(UID|GID)=' .env.docker)
fi

echo "🚀 Starting SnazzyAI development environment..."
echo "📋 Using UID=${UID:-unknown}, GID=${GID:-unknown} for container permissions"

# Determine compose files based on argument
if [[ "$1" == "host" ]]; then
    echo "🌐 Using host networking mode (Linux only)"
    echo "   This improves physical device discovery but only works on Linux"

    # Verify we're on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        echo "⚠️  Host networking mode is only supported on Linux"
        echo "   Falling back to normal port mapping mode"
        COMPOSE_FILES="-f compose.yml"
    else
        COMPOSE_FILES="-f compose.yml -f compose.host.yml"
    fi
else
    echo "🔌 Using port mapping mode (works everywhere)"
    COMPOSE_FILES="-f compose.yml"
fi

# Start services
echo "⚡ Starting Docker Compose services..."
docker compose $COMPOSE_FILES up --build --remove-orphans &

# Store compose process ID for cleanup
COMPOSE_PID=$!

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Stopping development environment..."
    docker compose $COMPOSE_FILES down
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

# Wait a moment for services to start
sleep 5

# Print helpful information
echo ""
echo "🎉 SnazzyAI development environment is starting!"
echo ""
echo "📱 ACCESS YOUR APP:"
echo "   • Backend API:       http://localhost:8000"
echo "   • Expo DevTools:     http://localhost:19000"
echo "   • Frontend (web):    http://localhost:19006"
echo ""
echo "📋 DEVELOPMENT TIPS:"

if [[ "$1" == "host" ]]; then
    echo "   • Host networking: Expo binds directly to your machine's network"
    echo "   • Device discovery: Physical devices should connect more reliably"
    echo "   • Backend URL:     http://localhost:8000 (not via Docker bridge)"
else
    echo "   • Port mapping: Services accessible via localhost ports"
    echo "   • Mobile devices: Scan QR code from Expo DevTools"
    echo "   • If device issues: Try ./scripts/dev/up.sh host (Linux only)"
fi

echo ""
echo "🔥 HOT RELOAD:"
echo "   • Frontend: Edit any .js/.jsx file to trigger reload"
echo "   • Backend:  Django auto-reloads on .py file changes"
echo ""
echo "🔧 ENVIRONMENT:"
echo "   • Backend URL:  EXPO_PUBLIC_BACKEND_URL=http://backend:8000 (internal)"
echo "   • API Keys:     Loaded from .env and backend/.env"
echo "   • File perms:   Running as UID=$UID, GID=$GID"
echo ""
echo "🛑 To stop: Press Ctrl+C"
echo ""

# Wait for compose process to finish
wait $COMPOSE_PID