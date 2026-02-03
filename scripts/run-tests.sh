#!/bin/bash
# Test runner script for AquaMine

export DATABASE_URL="postgresql+psycopg://aquamine:changeme@localhost:5432/aquamine_db"
export REDIS_URL="redis://localhost:6379/0"
export INGEST_API_KEY="test-ingest-key-12345"
export CLERK_SECRET_KEY="sk_test_12345"
export CLERK_ISSUER="https://test.clerk.accounts.dev"
export CORS_ORIGINS="http://localhost:3000"
export NIXTLA_API_KEY=""
export RATE_LIMIT_ENABLED="false"

cd /Users/macbook/Documents/coding/aquamine/ai
echo "Running backend tests..."
uv run pytest "$@"
