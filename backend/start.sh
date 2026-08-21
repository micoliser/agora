#!/bin/bash
# Start Celery worker
celery -A core worker -l info &
# Start Celery beat
celery -A core beat -l info &
# Start Django server
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
