# Backend Dockerfile for SnazzyAI Django API
# Optimized for development: small base image, hot reload, non-root user

FROM python:3.12-slim

# Environment settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=0

# Build arguments for user mapping
ARG UID=1000
ARG GID=1000

# Install system build/runtime deps (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    tzdata \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create matching user/group (avoid permission issues with bind mounts)
RUN groupadd -g ${GID} appuser && \
    useradd -u ${UID} -g appuser -m appuser

WORKDIR /app/backend

# Leverage layer caching: copy only requirements first
COPY backend/requirements.txt ./requirements.txt

# Install Python deps (keep pip cache so pip_cache volume is effective)
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install watchdog

# Switch to appuser before copying to avoid chown
USER appuser

# Copy project source (will be owned by appuser)
COPY --chown=appuser:appuser backend/ ./

EXPOSE 8000

# Run migrations then start dev server (reload handled by Django + watchdog)
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]