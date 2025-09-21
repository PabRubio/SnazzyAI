# Claude Code Instructions for SnazzyAI

## Project Overview
SnazzyAI is an AI-powered fashion outfit analysis and real product discovery application. Users capture outfit photos via the mobile app, which are analyzed using OpenAI GPT-4o vision to generate structured outfit metadata and targeted product search terms. The Django backend then performs web-search powered requests using OpenAI's Responses API (GPT-5) to return real, purchasable product suggestions.

## Architecture Summary
- **Frontend**: React Native 0.81.4 + Expo SDK 54 mobile app
- **Backend**: Django REST API server with OpenAI integration
- **AI Models**:
  - GPT-4o for image understanding and outfit analysis
  - GPT-5 with web_search tool for real product discovery
- **Key Features**: Camera capture with preview/retry, structured JSON outfit analysis, real product lookup, robust error handling with retry/backoff

## Project-Specific Guidelines

### Code Style & Conventions
- Use JavaScript ES6+ syntax (no TypeScript in this project)
- React Native components with functional components and hooks
- Follow existing patterns in App.js and service modules
- Maintain clean, self-documenting code without excessive comments
- Use descriptive variable and function names
- Keep functions focused and single-purpose

### Development Priorities
1. **Functionality First**: Ensure features work correctly before optimizing
2. **Test Coverage**: Write tests for new features and bug fixes
3. **Code Quality**: Run linting and type checking before marking tasks complete
4. **Documentation**: Update relevant docs only when functionality changes

### Before Completing Tasks
Always run these commands to ensure code quality:

**Docker Environment (Recommended):**
```bash
# Frontend diagnostics
docker compose exec frontend npx expo doctor

# Backend tests and health
docker compose exec backend python manage.py test
docker compose exec backend python manage.py check
curl -fsS http://localhost:8000/api/health/

# Check Metro bundler status
curl http://localhost:8081/status  # Should return {"status":"running"}
```

**Native Environment:**
```bash
# Frontend (React Native)
npx expo doctor        # Check Expo project health

# Backend (Django)
cd backend
python manage.py test     # Run Django tests
python manage.py check    # Check for issues
```

### Git Commit Conventions
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Reference Task Master task IDs in commits: `feat: implement feature (task 1.2)`

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## SnazzyAI Development Environment

### Docker Development (Recommended)
For consistent development environment across Ubuntu 22.04 & 24.04:

```bash
# One-time setup
./scripts/dev/bootstrap.sh

# Mobile Development (Recommended)
./scripts/dev/mobile.sh                      # Auto-detects LAN IP, minimal ports
./scripts/dev/mobile.sh --android            # Auto-launch Android if connected
./scripts/dev/mobile.sh --ngrok              # Expose backend publicly via ngrok

# Alternative: Full development
docker compose up --build                    # Normal mode
./scripts/dev/up.sh                          # Using helper script
./scripts/dev/up.sh host                     # Host networking (Linux only)
docker compose --profile mobile up           # Include ngrok service

# Access points
# Backend API: http://localhost:8000 or http://<LAN-IP>:8000
# Metro Bundler: http://localhost:8081
# Health Check: http://localhost:8000/api/health/
```

### Native Development (Alternative)
```bash
# Frontend - Start Expo development server
npm start          # Start Expo server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run in web browser

# Backend - Django server
cd backend
python manage.py runserver 0.0.0.0:8000  # Start Django server
./start_ngrok.sh                         # Start ngrok tunnel for mobile testing

# Environment setup
source backend/venv/bin/activate         # Activate Python virtual environment
```

### Project Structure Notes
- `/App.js` - Main React Native application component
- `/services` - Service modules (OpenAI integration)
- `/components` - Reusable React Native components
- `/constants` - App constants and configuration
- `/backend` - Django backend server
- `/backend/server` - Django app for API endpoints
- `/android` & `/ios` - Native platform code
- `/.taskmaster` - Task management files (do not edit manually)
- `/docker` - Docker development environment files
- `/scripts/dev` - Development helper scripts for Docker

### Key Files to Know
- `App.js` - Main app with camera and UI logic
- `services/openaiService.js` - OpenAI API integration and outfit analysis orchestration
- `backend/server/views.py` - Product search API endpoints using OpenAI Responses API
- `backend/server/urls.py` - URL patterns for API endpoints
- `components/ErrorBanner.js` - Simple error surface component
- `constants/apiKeys.js` - API key configuration
- `.env` - Environment variables (frontend, includes EXPO_PUBLIC_OPENAI_API_KEY)
- `backend/.env` - Environment variables (backend, includes OPENAI_API_KEY)
- `compose.yml` - Main Docker Compose configuration
- `compose.host.yml` - Linux host networking override
- `scripts/dev/bootstrap.sh` - Docker environment setup script
- `scripts/dev/mobile.sh` - Mobile-first development startup script
- `scripts/docker/frontend-health.sh` - Frontend healthcheck script
- `.env.docker` - Container user mapping (auto-generated)

## Important Reminders
- **Always use Task Master** to track development progress
- **Never commit directly to main branch** unless explicitly requested
- **Test all changes** before marking tasks as complete
- **Follow existing React Native and Django patterns**
- **Use Docker for development** - provides consistent environment across Ubuntu versions
- **API keys required**:
  - Frontend: `EXPO_PUBLIC_OPENAI_API_KEY` in `.env`
  - Backend: `OPENAI_API_KEY` in `backend/.env`
  - Optional: `NGROK_AUTHTOKEN` for tunnel testing
- **Only create new files when absolutely necessary**
- **Prefer editing existing files over creating new ones**
- **All API endpoints use `/api/` prefix** (e.g., `/api/health/`, `/api/search-products/`)

## Development Environment Setup
### Docker (Recommended for Team Development)
- **Consistent environment** across Ubuntu 22.04 & 24.04
- **Hot reload** for both frontend and backend
- **No "works on my machine" issues**
- **Proper file permissions** (no root-owned files)
- **Multiple mobile testing options** (QR code, host networking, ngrok)

### When to Use Native vs Docker
- **Use Docker when:**
  - Working in a team with different Ubuntu versions
  - Want guaranteed environment consistency
  - Need mobile device testing with multiple connection options
  - Prefer isolation from host system packages

- **Use Native when:**
  - Working solo with stable local environment
  - Need maximum performance (no container overhead)
  - Prefer direct access to system tools and debugging

## API Endpoints

Base URL: `http://localhost:8000` (development)

| Method | Path | Description | Request Body |
|--------|------|-------------|--------------|
| GET | `/api/health/` | Health probe | N/A |
| POST | `/api/search-products/` | Product web search via OpenAI | `{ "searchTerms": "white linen shirt" }` |

Example:
```bash
curl -X POST http://localhost:8000/api/search-products/ \
  -H 'Content-Type: application/json' \
  -d '{"searchTerms": "navy polo shirt slim fit"}'
```

## Data Flow
1. User captures photo in app
2. App encodes image (base64) and sends to OpenAI Chat Completions (GPT-4o)
3. OpenAI returns structured JSON (outfit metadata + searchTerms)
4. Client calls backend `/api/search-products/` with searchTerms
5. Backend uses OpenAI Responses API (GPT-5 with web_search tool) for real products
6. Backend returns `{ products: [...] }` to frontend for display

## Recent Fixes & Known Issues

### Fixed Issues
- **PlatformConstants module error**: Resolved by upgrading to React Native 0.81.4 + Expo SDK 54
- **Docker build slow chown**: Optimized by using COPY --chown and switching user before copy
- **UID/GID inconsistency**: Standardized all Docker configs to use UID/GID (not USER_ID/GROUP_ID)

### Common Troubleshooting
- **Metro bundler issues**: Clear with `docker compose exec frontend npx expo start -c`
- **Old dependencies cached**: Remove volumes with `docker compose down -v` and rebuild
- **Device can't connect**: Ensure `EXPO_PUBLIC_BACKEND_URL` uses LAN IP, not localhost
- **404 on /health/**: Use `/api/health/` (all endpoints under `/api/` prefix)
- **Empty product results**: OpenAI web search may return nothing; retry with better lighting

## Mobile Development Tips
### Docker Environment (Quick Start)
```bash
./scripts/dev/mobile.sh  # Automatically configures LAN IP and starts services
```
- **QR Code**: Check `docker compose logs frontend` for Expo QR code
- **Backend URL**: Automatically set to LAN IP (e.g., `http://192.168.1.22:8000`)
- **Metro Status**: Verify at `http://localhost:8081/status`
- **Device Connection Issues**:
  - Ensure phone and host on same Wi-Fi (no guest isolation/VPN)
  - Try `./scripts/dev/up.sh host` for Linux host networking
  - Clear Expo Go cache and rescan QR if needed
  - Use `--ngrok` flag for remote/off-LAN testing

### Native Environment
- Use `npm start` then press 'a' for Android, 'i' for iOS
- Test camera features on physical devices (simulators have limitations)
- Backend URL configured via `EXPO_PUBLIC_BACKEND_URL` env variable
- For off-LAN testing, use ngrok tunnel and update backend URL

## Testing Strategy

### Current State
- No formal Jest/RTL test suite for frontend yet
- Backend tests placeholder in `backend/server/tests.py`
- Focus on manual testing with physical devices for camera features

### Testing Checklist
1. **Backend Health**: `curl http://localhost:8000/api/health/`
2. **Metro Status**: `curl http://localhost:8081/status`
3. **Container Health**: `docker ps` - both should show "(healthy)"
4. **Bundle Build**: Check logs for successful Android/iOS bundle compilation
5. **Device Testing**: Scan QR code with Expo Go app on physical device

## Development Best Practices

### Code Quality
- Follow functional component patterns in existing code
- Keep functions focused and single-purpose
- Use descriptive naming (no abbreviations)
- Maintain consistent indentation and formatting

### Performance Considerations
- Current focus: Correctness and debuggability over performance
- No caching layer implemented yet (planned enhancement)
- Product search depends on OpenAI web_search latency (can be slow)
- Image encoding happens client-side (base64)

### Security Notes
- Never commit real API keys to repository
- Use environment variables for all sensitive configuration
- For production: implement rate limiting, HTTPS, proper ALLOWED_HOSTS
- Consider external secret management (Doppler, AWS Secrets Manager)

### Limitations (Current)
- No authentication or user accounts
- No persistence or history of analyses
- No rate limiting or caching layer
- Static fallback product data unused (kept for future offline mode)
