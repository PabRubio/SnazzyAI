# Claude Code Instructions for SnazzyAI

## Project Overview
SnazzyAI is a React Native/Expo mobile application for AI-powered fashion analysis. It captures outfit photos, analyzes them using OpenAI's GPT-4o vision model, and provides style recommendations with real product suggestions. The app features a Django backend for product search capabilities.

## Architecture Summary
- **Frontend**: React Native 0.79.5 + Expo SDK 53 mobile app
- **Backend**: Django 4.2.24 REST API server
- **AI**: OpenAI GPT-4o for image analysis and recommendations
- **Key Features**: Camera integration, outfit analysis, product recommendations

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
```bash
# Frontend (React Native)
npm test           # Run test suite (if configured)
expo doctor        # Check Expo project health

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

## SnazzyAI Specific Commands

### Quick Development Commands
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

### Key Files to Know
- `App.js` - Main app with camera and UI logic
- `services/openaiService.js` - OpenAI API integration and outfit analysis
- `backend/server/views.py` - Product search API endpoints
- `constants/apiKeys.js` - API key configuration
- `.env` - Environment variables (frontend)
- `backend/.env` - Environment variables (backend)

## Important Reminders
- Always use Task Master to track development progress
- Never commit directly to main branch unless explicitly requested
- Test all changes before marking tasks as complete
- Follow existing React Native and Django patterns
- When working on mobile features, test on both iOS and Android
- Update `BACKEND_URL` in `services/openaiService.js` when testing with ngrok
- Ensure both frontend and backend servers are running for full functionality
- API keys must be configured in both `.env` files (root and backend)
- Only create new files when absolutely necessary
- Prefer editing existing files over creating new ones

## Mobile Development Tips
- Use `expo start` for development with hot reloading
- Test camera features on physical devices (simulators have limitations)
- Check console logs in Expo Go app for debugging
- Use ngrok for testing backend API from mobile devices
- Remember to handle both iOS and Android platform differences
