#!/bin/bash
set -e

echo "Running database migrations..."
php artisan migrate --force || echo "Migration failed or already run"

echo "Clearing and caching config..."
php artisan config:clear
php artisan cache:clear

echo "Starting Laravel server..."
exec php artisan serve --host=0.0.0.0 --port=8080
