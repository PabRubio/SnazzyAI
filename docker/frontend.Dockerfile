# Frontend Dockerfile for SnazzyAI React Native/Expo
# Uses official Node image for reliability & smaller size

FROM node:18-bullseye

ARG USER_ID=1000
ARG GROUP_ID=1000

ENV CHOKIDAR_USEPOLLING=1 \
    EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0 \
    EXPO_USE_DEV_SERVER=1 \
    EXPO_NO_TUNNELING=1

# Install any native build deps needed by RN modules (minimal set)
# Include curl + iproute2 (for ss) used by healthcheck script
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    git \
    curl \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (idempotent if already exists)
RUN set -eux; \
    group_name="appuser"; \
    if ! getent group ${GROUP_ID} >/dev/null 2>&1; then groupadd -g ${GROUP_ID} "$group_name"; else group_name=$(getent group ${GROUP_ID} | cut -d: -f1); fi; \
    if ! id -u ${USER_ID} >/dev/null 2>&1; then useradd -u ${USER_ID} -g "$group_name" -m appuser; fi; \
    chown -R ${USER_ID}:$(getent group ${GROUP_ID} | cut -d: -f1) /home/appuser || true

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

USER appuser

EXPOSE 19000 19001 19002 19006 8081

# Start Expo (default script handles args). Can append --host 0.0.0.0 if needed.
CMD ["npm", "start"]