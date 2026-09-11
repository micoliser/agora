#!/bin/bash
# Apply database migrations

python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --timeout 120