# Repository Guidelines

## Project Structure & Module Organization
- `App.js` hosts the Expo React Native entry; reusable UI in `components/`, async integrations in `services/`, shared config in `constants/`, and static assets in `assets/`.
- Expo native shells live in `android/` and `ios/`; only touch them when ejected from Expo.
- Django API code sits in `backend/`: run tasks through `backend/manage.py`, API logic in `backend/server/views.py`, routing in `backend/server/urls.py`, settings in `backend/backend/settings.py`. Keep generated bundles in `dist/` so the root stays clean.

## Build, Test, and Development Commands
- `npm install` installs mobile dependencies; `python -m venv backend/venv && pip install -r backend/requirements.txt` prepares the server.
- `npm run start` launches the Expo dev server; `npm run android|ios|web` targets specific platforms.
- `python backend/manage.py runserver` starts the API (localhost:8000); `bash backend/start_ngrok.sh` opens an external tunnel when devices need access.
- Load AI keys via `.env` or `export OPENAI_API_KEY=...` before testing ML-driven features.

## Coding Style & Naming Conventions
- Frontend: two-space indentation, trailing semicolons, single quotes, camelCase for functions and variables, PascalCase for components. Import React/Expo modules first, custom helpers after.
- Services should stay side-effect free except for network calls; co-locate related helpers under `services/`.
- Backend: four-space indentation, snake_case identifiers, settings centralized in `backend/backend/settings.py`. Prefer class-based views for multi-endpoint resources and keep serializers close to their models.

## Testing Guidelines
- Add Jest + React Native Testing Library specs under `components/__tests__/` for UI states and hooks; snapshot cautiously.
- Backend tests belong in `backend/server/tests.py`; run them with `python backend/manage.py test`.
- Cover camera capture flows, AI failure handling, and every exposed REST endpoint. Document manual QA in PRs when automation is missing.

## Commit & Pull Request Guidelines
- Shift toward concise, imperative commits (`feat: add photo retry overlay`), wrapping at ~72 characters and referencing issue IDs when available.
- PRs should describe context, implementation, and verification steps; attach device screenshots or recordings for UI changes.
- Ensure `npm run start` and backend tests pass before requesting review, and keep secrets, large binaries, and device logs outside the diff.

## Security & Configuration Tips
- Never commit `.env`, `backend/venv/`, or raw media dumps. Rotate AI keys consistently and store them in your shell or a secrets manager.
- Scrub user imagery and access tokens from logs; prefer temporary URLs or signed storage when sharing assets.
