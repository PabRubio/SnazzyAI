# SnazzyAI

AI‑powered fashion outfit analysis + real product discovery.

SnazzyAI is a React Native (Expo) mobile app plus a Django backend. Users snap an outfit photo, the app analyzes it with OpenAI vision (gpt‑4o) to generate an outfit summary + targeted product search terms, then the backend performs a web_search powered request (OpenAI Responses API + gpt‑5) to return real purchasable product suggestions.

> Current state: Functional prototype focused on the capture → analysis → product search loop. Emphasis is on correctness, debuggability, and containerized DX (Ubuntu 22.04 & 24.04). Performance tuning, auth, persistence, and advanced caching are not yet implemented.

---
## Core Features
- Camera capture (Expo Camera) with preview & retry
- GPT‑4o image understanding → structured JSON (outfitName, shortDescription, rating, isValidPhoto, searchTerms)
- Real product lookup via backend `/api/search-products/` (OpenAI Responses API with `web_search` tool)
- Structured product objects: name, brand, description, price, imageUrl, purchaseUrl
- Robust OpenAI client layer: request/response logging (dev), retry & exponential backoff on transient failures
- Dockerized dev environment (frontend + backend + optional ngrok) with healthchecks:
  - Backend: HTTP `/api/health/`
  - Frontend: Script-based Metro/Expo readiness check (`scripts/docker/frontend-health.sh`)
- Task Master AI workflow integration (optional) for structured development tasks

---
## Quick Start (Docker Recommended)
```bash
# One-time environment prep
./scripts/dev/bootstrap.sh

# Start services (frontend + backend)
docker compose up --build
# or helper script
default: ./scripts/dev/up.sh
linux host networking: ./scripts/dev/up.sh host

# Optional: include ngrok tunnel for remote mobile testing
docker compose --profile mobile up --build
```
Access:
- Backend API: http://localhost:8000
- Metro status: http://localhost:8081/status (returns ok when bundler ready)
- Start web: `docker compose exec frontend npx expo start --web`
- Start Android emulator/device: `docker compose exec frontend npx expo start --android`

Expo CLI no longer always serves a legacy DevTools page on port 19000. Use the CLI QR code output in the frontend container logs (or start with the above commands) to load on a physical device.

---
## Native (Alternative) Development
```bash
# Frontend
npm install
npm start      # then choose platform (press a / i / w)

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```
If testing from a device off your LAN, start an ngrok tunnel (see Docker docs or `start_ngrok.sh`) and update the backend URL in the frontend service module (see Backend URL section below).

---
## Project Structure (Simplified)
```
SnazzyAI/
├ App.js                     # Main RN/Expo app (camera + UI flow)
├ services/
│  └ openaiService.js        # Outfit analysis + product search orchestration
├ components/
│  └ ErrorBanner.js          # Simple error surface
├ constants/
│  └ apiKeys.js              # Dev key handling (front-end side)
├ backend/
│  ├ backend/                # Django project settings
│  └ server/                 # Django app (views, urls)
│     ├ views.py             # /api/health/ + /api/search-products/
│     └ urls.py              # URL patterns
├ docker/                    # Dockerfiles
├ scripts/                   # Dev & health scripts
├ compose.yml                # Main docker compose
├ compose.host.yml           # Host networking override (Linux only)
├ assets/                    # Model + static assets
└ README.md
```

---
## Data Flow
1. User captures photo in app.
2. App encodes image (base64) and sends to OpenAI Chat Completions (`gpt-4o`) with a structured system prompt.
3. OpenAI returns JSON-like content; client parses & validates (outfit meta + searchTerms).
4. Client calls backend `POST /api/search-products/` with `{ "searchTerms": "..." }`.
5. Backend calls OpenAI Responses API (`model: gpt-5`, `tools: [web_search]`) instructing it to return exactly 5 product JSON objects.
6. Backend returns `{ products: [...] }` to frontend for display.

---
## API Endpoints (Backend)
Base (development): `http://localhost:8000`

| Method | Path                 | Description                   | Request Body Example |
|--------|----------------------|-------------------------------|----------------------|
| GET    | /api/health/         | Health probe (status ok)      | n/a                  |
| POST   | /api/search-products/| Product web search via OpenAI | `{ "searchTerms": "white linen shirt men's summer" }` |

Response (success):
```json
{
  "products": [
    {
      "name": "...",
      "brand": "...",
      "description": "...",
      "price": "$85",
      "imageUrl": "https://...",
      "purchaseUrl": "https://..."
    }
  ]
}
```
If lookup fails or returns nothing, `products` will be an empty array. No local static fallback is injected (static items are present in code but intentionally not used to avoid hallucinated inventory).

Curl example:
```bash
curl -X POST http://localhost:8000/api/search-products/ \
  -H 'Content-Type: application/json' \
  -d '{"searchTerms": "navy polo shirt slim fit"}'
```

---
## Frontend Analysis Usage
Key function: `analyzeOutfit(base64Image)` from `services/openaiService.js`.
Returns:
```js
{
  outfitName: string,
  shortDescription: string,        // 10–15 words
  rating: number,                  // 3–7 (moderate scale)
  isValidPhoto: boolean,
  recommendations: [ /* zero or more real products */ ]
}
```
`recommendations` length depends on backend search success (0..5). You can decide in UI whether to show placeholders if empty.

---
## Backend URL Configuration
Frontend resolves backend automatically:
```js
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://<your-local-ip>:8000'
```
Update `.env` (or Docker env) rather than editing code when possible.
- Docker: `EXPO_PUBLIC_BACKEND_URL=http://backend:8000` is injected for service-to-service calls.
- Physical device via LAN: ensure the value is your machine's LAN IP (e.g. `http://192.168.1.34:8000`).
- ngrok: set to your tunnel (e.g. `http://abc123.ngrok-free.app`). Use HTTP if Android has SSL trust issues.

All frontend calls expect API routes under `/api/` prefix (e.g. `/api/search-products/`).

---
## Environment Variables
Frontend (`.env`):
```
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
NGROK_AUTHTOKEN=your_token   # optional for tunnel
```
The `OPENAI_API_KEY` used in the frontend logic resolves from `EXPO_PUBLIC_OPENAI_API_KEY` (see `constants/apiKeys.js`). A placeholder will throw a validation error to help prevent accidental usage without a key.

Backend (`backend/.env`):
```
OPENAI_API_KEY=sk-...
DEBUG=True
SECRET_KEY=dev-secret
ALLOWED_HOSTS=*
```

---
## Healthchecks
Docker Compose defines:
- Backend: `curl http://localhost:8000/api/health/` (simple JSON `{"status": "ok"}`)
- Frontend: `scripts/docker/frontend-health.sh` which passes if ANY of these conditions is true:
  1. Metro status endpoint (8081) returns OK (`/status`)
  2. Legacy DevTools root (19000) responds (if served by current CLI)
  3. Expo process detected + either port 8081 or 19000 listening

Metro availability is the primary readiness indicator; DevTools on 19000 may not appear in newer Expo CLI versions.

---
## Development Workflow
1. Start environment (`docker compose up --build`).
2. Implement feature / fix.
3. (Optional) Use Task Master: `task-master next` → `task-master set-status`.
4. Test backend logic (add Django tests in `backend/server/tests.py` as needed).
5. Commit using conventional format (`feat: ...`, `fix: ...`, `chore(docs): ...`).

### Suggested Commands
```bash
# Frontend diagnostics (inside container)
docker compose exec frontend npx expo doctor

# Backend tests
docker compose exec backend python manage.py test

# Backend health
curl -fsS http://localhost:8000/api/health/
```

---
## Testing (Current State)
- No formal Jest/RTL test suite shipped yet for the frontend.
- Backend tests placeholder exists (`backend/server/tests.py`). Add targeted tests for parsing or endpoint logic as features stabilize.

---
## Limitations / Known Gaps
- No authentication or user accounts
- No persistence or history of analyses
- No rate limiting / caching layer yet (despite earlier placeholder notes)
- Product search depends on OpenAI `web_search` quality & latency (can be slow)
- Requires correct `EXPO_PUBLIC_BACKEND_URL` when changing environments
- Static fallback product data is unused (kept for potential offline mode experiment)

---
## Planned / Potential Enhancements
- Environment-driven backend URL resolution
- Caching + dedupe of identical product searches
- Local product enrichment / scoring layer
- Basic analytics & user session persistence
- Graceful UI placeholders when `recommendations` empty
- Optional static fallback toggle for demo mode

---
## Contributing
1. Create a feature branch
2. Keep changes narrowly scoped
3. Follow existing code style (functional components, clear naming)
4. Run health checks / minimal tests
5. Use conventional commits referencing tasks when applicable (e.g. `feat(analysis): improve prompt parsing (task 12)`)
6. Open a PR with concise rationale (focus on *why*)

---
## License
MIT — see `LICENSE` for full text.

---
## Security Notes
Do not commit real API keys. For production harden:
- External secret management (e.g. Doppler, AWS Secrets Manager)
- Add rate limiting (e.g. Django REST throttling)
- Enforce HTTPS & proper ALLOWED_HOSTS
- Add request size limits (image upload handling if moved server-side)

---
## Support / Questions
Open an issue or create a Task Master task describing the need. Provide logs (`OpenAI API Response Error`, `Product search error`) when relevant.

---
Happy styling!
