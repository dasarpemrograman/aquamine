FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY ./ai ./ai

RUN pip install --no-cache-dir \
    'fastapi>=0.115.0' \
    'nixtla>=0.6.0' \
    'pandas>=2.0.0' \
    'pillow>=10.0.0' \
    'psycopg[binary]>=3.2.1' \
    'pydantic>=2.9.0' \
    'python-multipart>=0.0.9' \
    'redis>=5.0.8' \
    'resend>=2.0.0' \
    'sqlalchemy>=2.0.32' \
    'ultralytics>=8.4.7' \
    'uvicorn[standard]>=0.30.6'

EXPOSE 8000

CMD ["uvicorn", "ai.main:app", "--host", "0.0.0.0", "--port", "8000"]
