FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai ./ai
COPY ./scripts/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

RUN pip install --upgrade pip

RUN pip install --no-cache-dir \
    'fastapi>=0.115.0' \
    'uvicorn[standard]>=0.30.6' \
    'pydantic>=2.9.0' \
    'sqlalchemy>=2.0.32' \
    'psycopg[binary]>=3.2.1' \
    'redis>=5.0.8' \
    'resend>=2.0.0' \
    'python-multipart>=0.0.9'

RUN pip install --no-cache-dir \
    'pandas>=2.0.0' \
    'numpy>=1.24.0' \
    'pillow>=10.0.0' \
    'nixtla>=0.6.0'

RUN pip install --no-cache-dir \
    'torch' \
    'sentence-transformers>=2.2.2' \
    'faiss-cpu>=1.7.4' \
    'ultralytics>=8.4.7' \
    'cerebras_cloud_sdk>=1.0.0'

EXPOSE 8181

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "ai.main:app", "--host", "0.0.0.0", "--port", "8181"]
