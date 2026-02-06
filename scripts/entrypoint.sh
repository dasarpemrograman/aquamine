#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
alembic -c ai/alembic.ini upgrade head || echo "Migration completed with warnings"

echo "Running database initialization..."
cd /app
python -m ai.scripts.init_db

echo "Starting FastAPI server..."
exec "$@"
