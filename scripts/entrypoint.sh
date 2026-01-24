#!/bin/sh
set -e

echo "Running database initialization..."
python -m ai.scripts.init_db

echo "Starting FastAPI server..."
exec "$@"
