# Backend Dockerfile for SnazzyAI Django API
# Base: python:3.12-slim for compatibility with Ubuntu 22.04 & 24.04
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Build arguments for user management (prevents root-owned files on host)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Create non-root user matching host UID/GID
RUN groupadd -g $GROUP_ID appuser && \
    useradd -r -u $USER_ID -g appuser appuser

# Set working directory
WORKDIR /app/backend

# Install Python dependencies
# Copy requirements first for Docker layer caching
COPY backend/requirements.txt ./requirements.txt

# Install pip dependencies with cache for faster rebuilds
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install watchdog for responsive Django auto-reload in containers
RUN pip install --no-cache-dir watchdog

# Create directory for app and change ownership
RUN mkdir -p /app/backend && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy backend code (this happens after user switch to preserve permissions)
COPY --chown=appuser:appuser backend/ ./

# Expose Django development server port
EXPOSE 8000

# Default command for development
# Run migrations then start development server
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]