# Frontend Dockerfile for SnazzyAI React Native/Expo
# Uses official Node image for reliability & smaller size

FROM node:20-bullseye

# Use built-in node user for simplicity
ENV CHOKIDAR_USEPOLLING=1 \
    EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
    EXPO_USE_DEV_SERVER=1 \
    EXPO_NO_TUNNELING=1

# Install native build deps needed by RN modules and healthcheck utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    git \
    curl \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first
COPY package*.json ./

# Install dependencies (ci for clean, reproducible installs)
RUN npm ci --no-audit --no-fund

# Copy rest of code
COPY . ./

# Ensure healthcheck script is executable (when coming from bind mount it should be, but for image build layer safety)
RUN chmod +x scripts/docker/frontend-health.sh || true

# Fix ownership (bind mounts will reflect host permissions)
RUN chown -R ${USER_ID}:$(getent group ${GROUP_ID} | cut -d: -f1) /app || true

USER node

EXPOSE 19000 19001 19002 19006 8081

# Start Expo (default script handles args). Can append --host 0.0.0.0 if needed.
CMD ["npm", "start"]