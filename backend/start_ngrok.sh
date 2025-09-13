#!/bin/bash

echo "Starting Django backend with ngrok tunnel..."

# Activate virtual environment
source venv/bin/activate

# Start Django in background
echo "Starting Django server on port 8000..."
python manage.py runserver &
DJANGO_PID=$!

# Give Django a moment to start
sleep 2

# Start ngrok
echo "Starting ngrok tunnel..."
echo "IMPORTANT: Use the HTTP URL (not HTTPS) to avoid SSL certificate issues on Android"
./ngrok http --host-header="localhost:8000" 8000 --log-level=info --log=stdout

# When ngrok is stopped, also stop Django
echo "Stopping Django server..."
kill $DJANGO_PID