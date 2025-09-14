# Frontend Dockerfile for SnazzyAI React Native/Expo App
# Base: node:18-bullseye for stable React Native support
FROM node:18-bullseye

# Build arguments for user management (prevents root-owned files on host)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Create non-root user matching host UID/GID
RUN groupadd -g $GROUP_ID appuser && \
    useradd -r -u $USER_ID -g appuser appuser

# Set working directory
WORKDIR /app

# Install system dependencies for React Native/Expo
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install npm dependencies as root first, then change ownership
RUN npm ci --only=production=false

# Create node_modules directory and change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy the rest of the application code
COPY --chown=appuser:appuser . ./

# Set environment variables for stable hot reload in containers
ENV CHOKIDAR_USEPOLLING=1
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV EXPO_USE_DEV_SERVER=1
ENV EXPO_NO_TUNNELING=1

# Expose Expo development server ports
# 19000: Expo DevTools web interface
# 19001: Expo bundler/packager
# 19002: Expo development tools
# 19006: Expo web server
# 8081: Metro bundler (React Native)
EXPOSE 19000 19001 19002 19006 8081

# Default command: Start Expo development server
# Use --lan to allow connections from same network (physical devices)
CMD ["npm", "start"]