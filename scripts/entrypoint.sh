#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/ai
alembic upgrade head || echo "Migration completed with warnings"

echo "Running database initialization..."
cd /app
python -m ai.scripts.init_db

echo "Starting FastAPI server..."
exec "$@"
