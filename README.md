# SnazzyAI

An AI-powered application designed to deliver intelligent solutions with style.

## Overview

SnazzyAI combines cutting-edge artificial intelligence capabilities with a polished user experience to provide smart, efficient, and elegant solutions for various use cases.

## Features

- **AI-Powered Intelligence**: Leverages advanced AI models for sophisticated processing
- **Task Management Integration**: Built-in Task Master support for organized development workflow
- **Modular Architecture**: Clean, maintainable codebase with clear separation of concerns
- **Extensible Design**: Easy to add new features and integrate additional AI capabilities

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- API keys for AI services (see Configuration section)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd SnazzyAI
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Initialize Task Master (for development):
```bash
task-master init
```

### Configuration

Create a `.env` file with the following API keys (at least one is required):

```env
ANTHROPIC_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
# Additional optional keys...
```

## Architecture

SnazzyAI is a React Native/Expo mobile application with a Django backend, designed for AI-powered fashion analysis and product recommendations.

### Technology Stack

**Frontend (Mobile App)**
- **React Native 0.79.5** with **Expo SDK 53** - Cross-platform mobile development
- **React 19.0.0** - Latest React features for optimal performance
- **Reanimated 3** - Smooth, performant animations
- **Gesture Handler** - Native gesture recognition
- **Bottom Sheet** - Modern UI interactions
- **Expo Camera** - Native camera integration for outfit capture

**Backend (API Server)**
- **Django 4.2.24** - Python web framework
- **Django REST Framework 3.15.2** - RESTful API development
- **CORS Headers** - Cross-origin request handling
- **Python 3.12** - Modern Python features

**AI Integration**
- **OpenAI GPT-4o** - Image analysis and fashion recommendations
- **Vision API** - Outfit analysis from captured photos
- **Custom prompt engineering** - Tailored fashion analysis responses

### System Architecture

```
┌─────────────────────────────────────────┐
│         Mobile App (React Native)        │
│  ┌─────────────────────────────────┐    │
│  │     Camera View Component       │    │
│  │  - Photo capture                │    │
│  │  - Preview & retake             │    │
│  └─────────────────────────────────┘    │
│                  ↓                       │
│  ┌─────────────────────────────────┐    │
│  │    OpenAI Service Module        │    │
│  │  - Image encoding (base64)      │    │
│  │  - API integration              │    │
│  │  - Response parsing             │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↓ HTTP/REST
┌─────────────────────────────────────────┐
│        Django Backend Server            │
│  ┌─────────────────────────────────┐    │
│  │    Product Search API           │    │
│  │  - Web scraping                 │    │
│  │  - Real product matching        │    │
│  │  - Price & availability         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         External Services               │
│  - OpenAI GPT-4o API                    │
│  - Product retailer APIs                │
│  - Image hosting services               │
└─────────────────────────────────────────┘
```

### Key Components

**Frontend Components**
- `App.js` - Main application component with camera and UI logic
- `services/openaiService.js` - AI service integration layer
- `components/ErrorBanner.js` - Error handling and user feedback
- `constants/apiKeys.js` - Secure API key management

**Backend Modules**
- `server/views.py` - API endpoints for product search
- `server/urls.py` - URL routing configuration
- `backend/settings.py` - Django configuration and middleware

### Data Flow

1. **Image Capture**: User takes photo using native camera
2. **Processing**: Image converted to base64 for transmission
3. **AI Analysis**: GPT-4o analyzes outfit and generates recommendations
4. **Product Search**: Backend searches for real products matching recommendations
5. **Results Display**: Formatted results shown in bottom sheet UI

### Security Considerations

- API keys stored in environment variables
- CORS properly configured for mobile app access
- HTTPS enforcement for production deployments
- Request validation and sanitization
- Rate limiting on API endpoints

### Performance Optimizations

- Lazy loading of heavy components
- Image compression before API transmission
- Response caching for repeated searches
- Animated transitions using native drivers
- Efficient state management with React hooks

## Development

### Task Management

This project uses Task Master AI for organized development. Key commands:

```bash
# View all tasks
task-master list

# Get next task to work on
task-master next

# Mark task as complete
task-master set-status --id=<task-id> --status=done

# Parse requirements document
task-master parse-prd .taskmaster/docs/prd.txt
```

### Project Structure

```
SnazzyAI/
├── .taskmaster/          # Task Master configuration and tasks
│   ├── tasks/           # Task files
│   ├── docs/            # Project documentation
│   └── config.json      # AI model configuration
├── src/                 # Source code
├── tests/               # Test files
├── .env                 # Environment variables
├── package.json         # Project dependencies
├── CLAUDE.md           # Claude Code instructions
└── README.md           # This file
```

### Development Workflow

1. **Start with a task**: Use `task-master next` to get your next task
2. **Review requirements**: Check task details with `task-master show <id>`
3. **Implement**: Build the feature following the task specifications
4. **Test**: Ensure your changes work correctly
5. **Complete**: Mark the task done with `task-master set-status`

## Usage

[Add specific usage instructions based on what SnazzyAI does]

## Testing

Run tests with:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## Contributing

1. Create a feature branch from `main`
2. Use Task Master to track your work
3. Write tests for new features
4. Ensure all tests pass and linting succeeds
5. Submit a pull request with clear description

## License

[Add license information]

## Support

For issues, questions, or suggestions, please open an issue on the project repository.

## Docker Development (Ubuntu 22.04 & 24.04)

### Prerequisites

- **Docker Engine ≥ 24** with **Compose v2** installed
- **Ubuntu 22.04 or 24.04** (other Linux distributions may work)
- **At least 4GB RAM** for containers

### Installation

Install Docker and Docker Compose on Ubuntu:

```bash
# Install Docker Engine
sudo apt update
sudo apt install ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

### Quick Start

1. **One-time setup**:
```bash
# Clone the repository
git clone <repository-url>
cd SnazzyAI

# Set up Docker environment
chmod +x scripts/dev/*.sh
./scripts/dev/bootstrap.sh
```

2. **Configure API keys**:
```bash
# Edit .env file (created by bootstrap.sh)
nano .env
# Add your EXPO_PUBLIC_OPENAI_API_KEY and NGROK_AUTHTOKEN

# Edit backend/.env file
nano backend/.env
# Add OPENAI_API_KEY and Django settings
```

3. **Start development environment**:
```bash
# Normal mode (recommended for most use cases)
docker compose up --build

# Or use the helper script with status information
./scripts/dev/up.sh

# For better mobile device discovery (Linux only)
./scripts/dev/up.sh host
```

### Development Modes

#### Normal Mode (Default)
Uses Docker port mapping. Works everywhere including WSL2, virtual machines, and all Linux distributions.

```bash
docker compose up --build
```

**Access your app:**
- Backend API: http://localhost:8000
- Expo DevTools: http://localhost:19000
- Frontend (web): http://localhost:19006
- Mobile app: Scan QR code from Expo DevTools

#### Host Networking Mode (Linux Only)
Better for physical device discovery when port mapping has issues. Only works on native Linux (Ubuntu 22/24).

```bash
# Using override compose file
docker compose -f compose.yml -f compose.host.yml up --build

# Using helper script
./scripts/dev/up.sh host
```

### Services

The Docker environment runs these services:

- **frontend**: React Native/Expo dev server with hot reload
- **backend**: Django API server with auto-reload
- **ngrok** (optional): Tunnel for mobile device testing

Enable ngrok with:
```bash
docker compose --profile mobile up --build
```

### Development Features

#### Hot Reload & Live Development
- **Frontend**: Edit any `.js`/`.jsx` file to trigger immediate reload in browser and mobile
- **Backend**: Django auto-reloads on `.py` file changes with instant API updates
- **Stable in containers**: Uses polling for reliable file watching across Ubuntu versions
- **Debugging**: Console logs available in both browser DevTools and mobile app

#### Cross-Platform Compatibility
- **Identical environment** on Ubuntu 22.04 and 24.04
- **Same commands** work for all developers
- **Consistent package versions** isolated in containers
- **No dependency conflicts** with host system

#### File Permissions & Security
- All containers run as your user UID/GID (prevents root-owned files)
- Source code mounted for editing with host tools (VS Code, etc.)
- `node_modules` and Python packages kept in containers for stability
- Environment variables properly isolated and secured

#### Backend Communication
- `EXPO_PUBLIC_BACKEND_URL`: Automatically set to `http://backend:8000` for service-to-service communication
- API keys securely loaded from `.env` and `backend/.env` files
- CORS properly configured for cross-origin requests
- Hot reload settings optimized for container environments

### Mobile Device Testing

#### Option 1: QR Code Scanning (Works Everywhere)
**Best for**: Most developers, works on all systems
```bash
docker compose up --build
# 1. Open http://localhost:19000 in your browser
# 2. Install Expo Go app on your phone
# 3. Scan QR code displayed in browser
# 4. App loads directly on your device with hot reload
```

#### Option 2: Host Networking (Linux Only)
**Best for**: Physical device discovery issues on Linux
```bash
./scripts/dev/up.sh host
# Direct network binding for better device discovery
# Only works on native Linux (Ubuntu 22/24, not WSL)
# Bypasses Docker networking for improved connectivity
```

#### Option 3: ngrok Tunnel (Remote Testing)
**Best for**: Testing from outside your network, sharing with others
```bash
# 1. Get ngrok auth token from https://dashboard.ngrok.com/get-started/your-authtoken
# 2. Add NGROK_AUTHTOKEN=your_token_here to .env file
# 3. Start with mobile profile:
docker compose --profile mobile up --build
# 4. Check logs for public ngrok URL
# 5. Use public URL to test from anywhere
```

#### Troubleshooting Mobile Connections
```bash
# If QR code doesn't work, try host networking (Linux only)
./scripts/dev/up.sh host

# Check firewall settings
sudo ufw status
sudo ufw allow 19000:19006/tcp

# Verify both devices on same Wi-Fi network
ip route | grep default    # Check your local network
```

### Troubleshooting

#### Permission Issues
```bash
# Fix ownership of any root-owned files
sudo chown -R $USER:$USER .

# Re-run bootstrap to set correct UID/GID
./scripts/dev/bootstrap.sh
```

#### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ':(8000|19000)'

# Stop conflicting services
sudo systemctl stop apache2  # Example
```

#### Container Issues
```bash
# Clean rebuild
docker compose down --volumes
docker system prune -f
docker compose up --build

# View logs
docker compose logs frontend
docker compose logs backend
```

#### Mobile Connection Issues
```bash
# Try host networking mode (Linux only)
./scripts/dev/up.sh host

# Check firewall
sudo ufw status
sudo ufw allow 19000:19006/tcp
```

### Stopping the Environment

```bash
# Ctrl+C in the terminal, or:
docker compose down

# Remove volumes (clean slate)
docker compose down --volumes
```

### Docker Files Structure

```
SnazzyAI/
├── docker/                          # Docker configuration
│   ├── backend.Dockerfile           # Django container (Python 3.12)
│   └── frontend.Dockerfile          # React Native/Expo container (Node 18)
├── scripts/dev/                     # Development scripts
│   ├── bootstrap.sh                 # One-time environment setup
│   └── up.sh                        # Development server startup
├── compose.yml                      # Main Docker Compose configuration
├── compose.host.yml                 # Linux host networking override
├── .dockerignore                    # Build context exclusions
├── .env.docker                      # Container user mapping (auto-generated)
├── .env                            # Frontend environment variables
└── backend/.env                     # Backend environment variables
```

### Commands Reference

```bash
# Initial setup (run once)
./scripts/dev/bootstrap.sh

# Daily development commands
./scripts/dev/up.sh                  # Normal mode with helpful output
./scripts/dev/up.sh host             # Linux host networking mode
docker compose up --build           # Direct Docker command
docker compose --profile mobile up  # Include ngrok for remote testing

# Service management
docker compose down                  # Stop all services
docker compose down --volumes        # Stop and remove data volumes
docker compose logs frontend         # View frontend logs
docker compose logs backend          # View backend logs
docker compose exec frontend npm test    # Run tests in frontend container
docker compose exec backend python manage.py test  # Run backend tests

# Troubleshooting
docker system prune -f              # Clean unused Docker resources
sudo chown -R $USER:$USER .         # Fix file permissions
```

### Environment Variables

**Frontend (.env):**
```bash
# Required for AI features
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key

# Optional for remote mobile testing
NGROK_AUTHTOKEN=your_ngrok_auth_token
```

**Backend (backend/.env):**
```bash
# AI Integration
OPENAI_API_KEY=your_openai_api_key

# Django Configuration
DEBUG=True
SECRET_KEY=your_django_secret_key
ALLOWED_HOSTS=*

# API Settings
API_TIMEOUT=30
MAX_RETRIES=3
CACHE_TIMEOUT=900
```

## Acknowledgments

- Built with Task Master AI for organized development workflow
- Powered by advanced AI models for intelligent processing