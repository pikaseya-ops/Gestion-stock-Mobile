#!/bin/sh

gunicorn --bind 0.0.0.0:5000 --access-logfile - --error-logfile - "app:app"