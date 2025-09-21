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

# Create user matching host UID/GID for proper permissions
ARG UID=1000
ARG GID=1000
RUN if [ "${UID}" != "1001" ]; then \
      usermod -u ${UID} node && \
      groupmod -g ${GID} node; \
    fi

# Switch to node user before copying to avoid chown
USER node

# Copy rest of code (will be owned by node user)
COPY --chown=node:node . ./

# Ensure healthcheck script is executable
USER root
RUN chmod +x scripts/docker/frontend-health.sh || true
USER node

EXPOSE 19000 19001 19002 19006 8081

# Start Expo (default script handles args). Can append --host 0.0.0.0 if needed.
CMD ["npm", "start"]