# AquaMine VPS Deployment Guide

## Overview

Panduan lengkap untuk deploy AquaMine ke VPS Ubuntu 22.04 dengan Docker Compose. Semua masalah deployment yang umum terjadi (API tidak bisa diakses, WebSocket gagal connect, CV upload error) sudah diperbaiki.

---

## Prerequisites

1. **VPS Ubuntu 22.04** dengan minimal:
   - 2 CPU cores
   - 4GB RAM
   - 20GB storage
   - Public IP address

2. **Domain (optional tapi recommended)**
   - Jika pakai HTTPS/SSL, domain wajib
   - Jika cuma HTTP, bisa pakai IP langsung

3. **Ports yang harus dibuka**:
   - Port 80 (HTTP)
   - Port 443 (HTTPS, jika pakai SSL)

---

## Step 1: Persiapan VPS

### 1.1 SSH ke VPS

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Update system

```bash
apt-get update && apt-get upgrade -y
```

### 1.3 Install Docker

```bash
# Install dependencies
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 1.4 Configure firewall

```bash
# Allow SSH (jangan lupa ini, nanti ga bisa masuk lagi!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## Step 2: Clone Project

```bash
# Install git jika belum ada
apt-get install -y git

# Clone repository
cd /opt
git clone https://github.com/dasarpemrograman/aquamine.git
cd aquamine
```

---

## Step 3: Configure Environment

### 3.1 Copy .env.example

```bash
cp .env.example .env
```

### 3.2 Edit .env file

```bash
nano .env
```

**CRITICAL:** Update semua URL dari `localhost` ke IP/domain VPS Anda:

```bash
# Database (biarkan default, atau ganti password)
POSTGRES_USER=aquamine
POSTGRES_PASSWORD=GANTI_PASSWORD_INI_DENGAN_YANG_KUAT
POSTGRES_DB=aquamine_db
DATABASE_URL=postgresql+psycopg://aquamine:GANTI_PASSWORD_INI_DENGAN_YANG_KUAT@db:5432/aquamine_db
REDIS_URL=redis://redis:6379/0

# Frontend URLs - GANTI localhost dengan IP/domain VPS Anda
# Jika pakai IP:
NEXT_PUBLIC_API_BASE_URL=http://123.45.67.89/api
NEXT_PUBLIC_WS_BASE_URL=ws://123.45.67.89
NEXT_PUBLIC_API_URL=http://123.45.67.89/api

# Jika pakai domain:
# NEXT_PUBLIC_API_BASE_URL=http://aquamine.yourdomain.com/api
# NEXT_PUBLIC_WS_BASE_URL=ws://aquamine.yourdomain.com
# NEXT_PUBLIC_API_URL=http://aquamine.yourdomain.com/api

# Backend CORS - GANTI dengan URL dashboard Anda (tanpa /api)
# Jika pakai IP:
CORS_ORIGINS=http://123.45.67.89

# Jika pakai domain:
# CORS_ORIGINS=http://aquamine.yourdomain.com
```

**PENTING:** 
- Variabel `NEXT_PUBLIC_*` harus di-set SEBELUM build
- Next.js "memanggang" nilai ini ke dalam bundle JavaScript saat build time
- Kalau salah, harus rebuild ulang dashboard container

Save file: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 4: Deploy

### 4.1 Build dan start semua services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Proses ini akan:
1. Build dashboard image dengan env vars yang sudah diset
2. Pull image untuk PostgreSQL, Redis, Nginx
3. Build API dan simulator images
4. Start semua containers

**Estimasi waktu:** 5-10 menit (tergantung koneksi internet dan CPU VPS)

### 4.2 Monitor build process

```bash
# Watch logs real-time
docker compose -f docker-compose.prod.yml logs -f

# Ctrl+C untuk stop watching (containers tetap jalan)
```

### 4.3 Check container status

```bash
docker compose -f docker-compose.prod.yml ps
```

**Expected output:** Semua services status `Up`, dan DB service harus `healthy`:

```
NAME                     STATUS              PORTS
aquamine-api-1           Up                  8181/tcp
aquamine-dashboard-1     Up                  3000/tcp
aquamine-db-1            Up (healthy)        5432/tcp
aquamine-nginx-1         Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
aquamine-redis-1         Up                  6379/tcp
aquamine-simulator-1     Up                  
```

---

## Step 5: Verification

### 5.1 Test API via curl

```bash
# Test health endpoint
curl http://localhost/health

# Test sensors endpoint
curl http://localhost/api/v1/sensors

# Expected: JSON response (mungkin empty array [] kalau belum ada data)
```

### 5.2 Test dari browser (komputer lokal)

1. **Open dashboard:**
   - Buka `http://YOUR_VPS_IP` di browser
   - Dashboard harus load tanpa error

2. **Check browser console (F12 → Console tab):**
   - Tidak boleh ada error "failed to fetch"
   - Tidak boleh ada URL `localhost:8181` (harusnya IP/domain VPS)

3. **Check Network tab (F12 → Network tab):**
   - Request harus ke `http://YOUR_VPS_IP/api/v1/...`
   - Response status harus 200 OK

4. **Check WebSocket:**
   - Console harus show "WebSocket connected" atau similar
   - Tidak boleh ada error connection refused

### 5.3 Test CV upload

```bash
# Create test image (2MB)
dd if=/dev/zero of=/tmp/test-image.jpg bs=1M count=2

# Upload via API
curl -X POST -F "image=@/tmp/test-image.jpg" http://localhost/api/v1/cv/analyze

# Expected: 200 OK dengan JSON response (bukan 413 error)
```

---

## Step 6: SSL/HTTPS Setup (Optional tapi Recommended)

### 6.1 Pastikan domain sudah point ke VPS

```bash
# Test DNS resolution dari VPS
nslookup aquamine.yourdomain.com

# Harus return IP VPS Anda
```

### 6.2 Install Certbot

```bash
apt-get install -y certbot
```

### 6.3 Stop Nginx container sementara

```bash
docker compose -f docker-compose.prod.yml stop nginx
```

### 6.4 Generate SSL certificate

```bash
certbot certonly --standalone -d aquamine.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - (Optional) Share email with EFF
```

Certificates akan disimpan di:
- `/etc/letsencrypt/live/aquamine.yourdomain.com/fullchain.pem`
- `/etc/letsencrypt/live/aquamine.yourdomain.com/privkey.pem`

### 6.5 Update Nginx configuration

```bash
nano deploy/nginx/default.conf
```

Add HTTPS server block (uncomment jika sudah ada template):

```nginx
server {
    listen 443 ssl;
    server_name aquamine.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/aquamine.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aquamine.yourdomain.com/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass http://dashboard:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://api:8181;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://api:8181;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name aquamine.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### 6.6 Mount certificates ke Nginx container

Edit `docker-compose.prod.yml`:

```yaml
nginx:
  image: nginx:alpine
  container_name: aquamine-nginx
  volumes:
    - ./deploy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro  # Add this line
  ports:
    - "80:80"
    - "443:443"
  depends_on:
    - api
    - dashboard
  networks:
    - aquamine-network
```

### 6.7 Update .env untuk HTTPS

```bash
nano .env
```

Change URLs to HTTPS dan WebSocket ke WSS:

```bash
NEXT_PUBLIC_API_BASE_URL=https://aquamine.yourdomain.com/api
NEXT_PUBLIC_WS_BASE_URL=wss://aquamine.yourdomain.com
NEXT_PUBLIC_API_URL=https://aquamine.yourdomain.com/api
CORS_ORIGINS=https://aquamine.yourdomain.com
```

### 6.8 Rebuild dashboard (karena env vars berubah)

```bash
docker compose -f docker-compose.prod.yml up -d --build dashboard
```

### 6.9 Start Nginx

```bash
docker compose -f docker-compose.prod.yml start nginx
```

### 6.10 Test HTTPS

```bash
curl https://aquamine.yourdomain.com/health
```

---

## Troubleshooting

### Problem: 502 Bad Gateway

**Symptom:** Nginx returns 502 error

**Diagnosis:**
```bash
# Check Nginx logs
docker compose -f docker-compose.prod.yml logs nginx

# Check API container status
docker compose -f docker-compose.prod.yml ps api

# Check API logs
docker compose -f docker-compose.prod.yml logs api
```

**Common causes:**
- API container crashed → Check API logs for Python errors
- API not listening on port 8181 → Verify `ai/main.py` has `uvicorn.run(app, host="0.0.0.0", port=8181)`
- Database not ready → Check DB health status

**Fix:**
```bash
# Restart API
docker compose -f docker-compose.prod.yml restart api

# If DB issue, restart DB first
docker compose -f docker-compose.prod.yml restart db
sleep 10
docker compose -f docker-compose.prod.yml restart api
```

---

### Problem: Dashboard shows "failed to fetch"

**Symptom:** Browser console shows errors like:
```
Failed to fetch http://localhost:8181/api/v1/sensors
```

**Diagnosis:**
Open browser DevTools → Network tab. Check request URL.

**If URL is `localhost:8181`:** Environment variables tidak ter-bake ke dashboard build.

**Fix:**
1. Update `.env` with correct VPS IP/domain
2. Rebuild dashboard:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build dashboard
   ```

---

### Problem: WebSocket not connecting

**Symptom:** Console shows WebSocket error or "connection refused"

**Diagnosis:**
```bash
# Check Nginx WebSocket proxy logs
docker compose -f docker-compose.prod.yml logs nginx | grep "/ws/"

# Check for mixed content warnings in browser console
```

**Common causes:**
- Using `ws://` on HTTPS page (mixed content blocked by browser)
- Nginx WebSocket timeout too short
- Wrong WebSocket URL in `.env`

**Fix for mixed content (HTTPS + ws://):**
1. Update `.env`:
   ```bash
   NEXT_PUBLIC_WS_BASE_URL=wss://aquamine.yourdomain.com
   ```
2. Rebuild dashboard:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build dashboard
   ```

---

### Problem: CV upload fails with 413 error

**Symptom:** Nginx returns `413 Request Entity Too Large`

**Diagnosis:**
```bash
# Check Nginx error logs
docker compose -f docker-compose.prod.yml logs nginx | grep 413
```

**Fix:**
Nginx config should already have `client_max_body_size 10m;`. Verify:
```bash
docker compose -f docker-compose.prod.yml exec nginx cat /etc/nginx/conf.d/default.conf | grep client_max_body_size
```

If missing, add to `deploy/nginx/default.conf` and restart:
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

### Problem: Containers crash loop or fail to start

**Symptom:** `docker compose ps` shows services restarting repeatedly

**Diagnosis:**
```bash
# Check which container is failing
docker compose -f docker-compose.prod.yml ps

# Check logs for that specific container
docker compose -f docker-compose.prod.yml logs <service-name>
```

**Common causes:**
- API crashes because DB not ready → Wait for DB to be `healthy`
- Missing environment variables
- Port conflicts

**Fix:**
```bash
# Restart in order: DB first, then others
docker compose -f docker-compose.prod.yml restart db
sleep 15
docker compose -f docker-compose.prod.yml restart api simulator
```

---

### Problem: Can't access from browser (connection timeout)

**Symptom:** Browser can't reach `http://YOUR_VPS_IP`

**Diagnosis:**
```bash
# From VPS, test locally
curl http://localhost

# Check if Nginx is listening
docker compose -f docker-compose.prod.yml ps nginx

# Check firewall
ufw status
```

**Common causes:**
- Firewall blocking port 80/443
- Nginx not bound to 0.0.0.0
- VPS provider firewall (check cloud console)

**Fix:**
```bash
# Open ports
ufw allow 80/tcp
ufw allow 443/tcp

# Restart Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

Also check VPS provider's security group/firewall settings.

---

## Maintenance

### Update deployment dengan perubahan code baru

```bash
cd /opt/aquamine
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Restart services

```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart api
```

### Stop deployment

```bash
docker compose -f docker-compose.prod.yml down
```

### Backup database

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U aquamine aquamine_db > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T db psql -U aquamine aquamine_db < backup_20260125.sql
```

### Renew SSL certificate (setiap 90 hari)

```bash
# Stop Nginx
docker compose -f docker-compose.prod.yml stop nginx

# Renew
certbot renew

# Start Nginx
docker compose -f docker-compose.prod.yml start nginx
```

---

## Performance Tips

### 1. Monitor resource usage

```bash
# Check container stats
docker stats

# Check disk space
df -h

# Check memory
free -h
```

### 2. Prune unused Docker resources

```bash
# Remove unused images, containers, volumes
docker system prune -a --volumes

# WARNING: This will delete all stopped containers and unused images
```

### 3. Optimize PostgreSQL (jika DB lambat)

Edit `docker-compose.prod.yml`:

```yaml
db:
  image: timescale/timescaledb:latest-pg15
  environment:
    # Add these
    - POSTGRES_INITDB_ARGS=-c shared_buffers=256MB -c max_connections=100
  command: postgres -c max_connections=100 -c shared_buffers=256MB
```

Then restart:
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate db
```

---

## Security Checklist

- [ ] Changed default `POSTGRES_PASSWORD` in `.env`
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] SSH key authentication enabled (disable password login)
- [ ] SSL/HTTPS enabled with valid certificate
- [ ] Regular backups configured
- [ ] Keep Docker and system packages updated
- [ ] Monitor logs for suspicious activity

---

## Support

Jika masih ada masalah setelah ikuti guide ini:

1. Check troubleshooting section di atas
2. Check logs: `docker compose -f docker-compose.prod.yml logs`
3. Buka issue di GitHub repository dengan:
   - Output dari `docker compose ps`
   - Relevant logs
   - Browser console errors (jika frontend issue)
   - Steps untuk reproduce masalahnya

---

## Changelog

- **2026-01-25:** Initial deployment guide
  - Fixed Nginx port routing (8000→8181)
  - Fixed URI preservation for API endpoints
  - Switched dashboard to Node.js + npm
  - Added database healthcheck
  - Added upload limits and WebSocket timeouts
  - Complete VPS deployment instructions
