#!/bin/bash
# Apply database migrations
python manage.py migrate

# Start Celery worker with strict memory limits
celery -A core worker --concurrency=1 --max-tasks-per-child=50 -l info &

# Start Celery beat
celery -A core beat -l info &

# Start Django server with minimal workers
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2
