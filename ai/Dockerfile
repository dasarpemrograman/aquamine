FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    python3-dev \
    curl \
    wget \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1
ENV UV_SYSTEM_PYTHON=1

COPY ai/uv.lock ai/pyproject.toml ./ai/
COPY scripts/entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

WORKDIR /app/ai
RUN uv export \
    --frozen \
    --no-dev \
    --no-emit-project \
    --format requirements.txt \
    --output-file /tmp/requirements.txt

RUN uv pip sync --system --require-hashes /tmp/requirements.txt

WORKDIR /app
COPY ai/ ./ai/

ENV PYTHONPATH=/app

EXPOSE 8181

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "ai.main:app", "--host", "0.0.0.0", "--port", "8181"]
