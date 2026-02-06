# AquaMine Production Deployment Checklist

## Pre-Deployment (Local Preparation)

### 1. Environment Variables
Update `.env` file with production values:

**Critical Variables:**
- [ ] `NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api` (or `http://VPS_IP/api`)
- [ ] `NEXT_PUBLIC_WS_BASE_URL=wss://your-domain.com` (HTTPS) or `ws://VPS_IP` (HTTP)
- [ ] `CORS_ORIGINS=https://your-domain.com` (match dashboard URL)
- [ ] `ENVIRONMENT=production`
- [ ] `NEXT_PUBLIC_SITE_URL=https://your-domain.com`

**Authentication:**
- [ ] `CLERK_SECRET_KEY` (production key from Clerk dashboard)
- [ ] `CLERK_ISSUER` (production issuer URL)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production public key)
- [ ] `SUPERADMIN_EMAIL` (your admin email)
- [ ] `INGEST_API_KEY` (generate strong random key)

**MQTT IoT Integration:**
- [ ] `MQTT_BROKER` (HiveMQ Cloud or your MQTT broker)
- [ ] `MQTT_PORT` (usually 8883 for TLS)
- [ ] `MQTT_USERNAME`
- [ ] `MQTT_PASSWORD`
- [ ] `MQTT_TOPIC_PREFIX` (e.g., `itb/surya/water/data`)
- [ ] `MQTT_CLIENT_ID` (e.g., `aquamine_prod_listener`)
- [ ] `MQTT_TLS_INSECURE=false` (set to `true` only if using self-signed certs)

**Optional Services:**
- [ ] `NIXTLA_API_KEY` (TimeGPT forecasting)
- [ ] `CEREBRAS_API_KEY` (AI chatbot)
- [ ] `FONNTE_API_TOKEN` (WhatsApp notifications)
- [ ] `RESEND_API_KEY` (Email notifications)

**Database:**
- [ ] `POSTGRES_PASSWORD` (generate strong password)
- [ ] `DATABASE_URL` (update with production password)

### 2. Security Review
- [ ] All API keys are strong and unique
- [ ] No `.env` file committed to git (check `.gitignore`)
- [ ] MQTT credentials are from production broker (not dev/test)
- [ ] `ENVIRONMENT=production` is set

### 3. Build Verification (Local)
```bash
# Validate docker-compose syntax
docker compose -f docker-compose.prod.yml config

# Test production build locally (optional)
docker compose -f docker-compose.prod.yml up --build
```

## VPS Deployment

### 1. Server Setup
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (if not included)
sudo apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 2. Firewall Configuration
```bash
# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 3. SSL Certificate (HTTPS)
```bash
# Install certbot
sudo apt-get install -y certbot

# Point DNS A record to VPS IP first, then:
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

Update `deploy/nginx/default.conf`:
- [ ] Replace `aquamine.web.id` with your domain (lines 18, 80)
- [ ] Update SSL cert paths (lines 20-21)

### 4. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-org/aquamine.git
cd aquamine

# Copy and configure .env
cp .env.example .env
nano .env  # Update all variables from Pre-Deployment checklist

# Build and start services
docker compose -f docker-compose.prod.yml up -d --build

# Monitor startup
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Verify Deployment
```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Expected output:
# - db (healthy)
# - redis (healthy)
# - api (healthy)
# - dashboard (healthy)
# - mqtt-listener (running)
# - simulator (running)
# - nginx (healthy)

# Check individual service logs
docker compose -f docker-compose.prod.yml logs api --tail 50
docker compose -f docker-compose.prod.yml logs mqtt-listener --tail 50
docker compose -f docker-compose.prod.yml logs dashboard --tail 50
```

### 6. Test Services

**Health Check:**
```bash
curl https://your-domain.com/health
# Expected: 200 OK with API health status
```

**WebSocket (from browser console):**
```javascript
const ws = new WebSocket('wss://your-domain.com/ws/realtime');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
// Expected: Connection established, messages received
```

**MQTT Ingestion:**
- [ ] Check ESP32 is sending data to MQTT broker
- [ ] Verify data appears in database: 
  ```bash
  docker compose -f docker-compose.prod.yml exec db psql -U aquamine -d aquamine_db -c "SELECT * FROM readings ORDER BY timestamp DESC LIMIT 5;"
  ```
- [ ] Check mqtt-listener logs for "Stored reading" messages

**Dashboard Access:**
- [ ] Visit `https://your-domain.com`
- [ ] Login with Clerk authentication
- [ ] Navigate to `/analytics`
- [ ] Toggle "Mode Realtime" ON
- [ ] Select a sensor from dropdown
- [ ] Verify chart updates every 5 seconds with live data
- [ ] Check connection status shows "Terhubung" (Connected)

### 7. SSL Auto-Renewal Setup
```bash
# Test renewal process
sudo certbot renew --dry-run

# Add cron job for auto-renewal (runs twice daily)
sudo crontab -e

# Add this line:
0 0,12 * * * certbot renew --quiet --post-hook "docker compose -f /path/to/aquamine/docker-compose.prod.yml restart nginx"
```

## Post-Deployment

### Monitoring
```bash
# View logs for all services
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs mqtt-listener -f
docker compose -f docker-compose.prod.yml logs api -f

# Check container resource usage
docker stats
```

### Backup Database
```bash
# Create backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U aquamine aquamine_db > backup_$(date +%Y%m%d).sql

# Restore from backup
cat backup_20260207.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U aquamine aquamine_db
```

### Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart services
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

## Troubleshooting

### WebSocket Not Connecting
1. Check `NEXT_PUBLIC_WS_BASE_URL` uses `wss://` (not `ws://`) for HTTPS
2. Verify Nginx WebSocket proxy config in `deploy/nginx/default.conf`
3. Check browser console for mixed content warnings
4. Test WebSocket endpoint: `wscat -c wss://your-domain.com/ws/realtime`

### MQTT Listener Not Receiving Data
1. Check container is running: `docker compose -f docker-compose.prod.yml ps mqtt-listener`
2. View logs: `docker compose -f docker-compose.prod.yml logs mqtt-listener --tail 100`
3. Verify MQTT credentials in `.env`
4. Test MQTT connection from ESP32 directly
5. Fallback: Use HTTP ingest endpoint instead of MQTT

### Dashboard Shows "Failed to fetch"
1. Check API container is healthy: `docker compose -f docker-compose.prod.yml ps api`
2. Verify `NEXT_PUBLIC_API_BASE_URL` matches your domain
3. Rebuild dashboard: `docker compose -f docker-compose.prod.yml up -d --build dashboard`
4. Check CORS origins in API logs

### Database Migration Errors
```bash
# Force rebuild and run migrations
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build api
docker compose -f docker-compose.prod.yml logs api | grep migration
```

## Rollback Procedure
```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Checkout previous version
git checkout <previous-commit-hash>

# Restore database backup
cat backup_previous.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U aquamine aquamine_db

# Start services
docker compose -f docker-compose.prod.yml up -d --build
```

## Security Hardening

### 1. Change Default Passwords
- [ ] PostgreSQL password
- [ ] MQTT broker credentials
- [ ] Ingest API key

### 2. Restrict Database Access
Add to `docker-compose.prod.yml` db service:
```yaml
ports: []  # Remove external port exposure
```

### 3. Enable Fail2ban (Optional)
```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Regular Updates
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Support Contacts
- ESP32 MQTT Issues: Check HiveMQ Cloud dashboard
- Clerk Auth Issues: Check Clerk dashboard
- Deployment Questions: See README.md troubleshooting section
