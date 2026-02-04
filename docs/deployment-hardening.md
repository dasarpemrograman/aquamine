# Deployment Hardening Guide

This document describes the security and reliability hardening applied to the AquaMine deployment configuration.

## Proxy Configuration

### Nginx Reverse Proxy Headers

All locations now properly forward headers to the FastAPI backend:

- `X-Real-IP`: Original client IP address
- `X-Forwarded-For`: Chain of proxy addresses
- `X-Forwarded-Proto`: Original protocol (http/https)

These headers allow FastAPI to correctly identify the original client when running behind Nginx.

### WebSocket Proxying

WebSocket connections at `/ws/` are properly configured with:
- `Upgrade` and `Connection` headers for protocol switching
- Long timeouts (3600s) for persistent connections
- Proper forwarded headers for client identification

## FastAPI Middleware

### ProxyHeadersMiddleware

Added `ProxyHeadersMiddleware` to process `X-Forwarded-*` headers:
- Correctly identifies client IP behind reverse proxy
- Determines original protocol (HTTP vs HTTPS)
- Essential for proper Clerk authentication callback URLs

### TrustedHostMiddleware (Production)

In production (`ENVIRONMENT=production`), FastAPI validates the `Host` header:
- Only accepts requests to `aquamine.web.id` and `*.aquamine.web.id`
- Prevents HTTP Host header attacks

## TLS Configuration

Nginx is configured with:
- TLS 1.2 and 1.3 only (no deprecated SSL versions)
- Strong cipher suites
- HSTS header (max-age=63072000, includeSubDomains, preload)
- Automatic HTTP to HTTPS redirect

## File Upload Limits

- Nginx: `client_max_body_size 10m` (consistent with API limit)
- API: 10MB upload limit for CV analysis

## Verification

To verify the configuration works:

1. **HTTPS Redirect**: `curl -I http://aquamine.web.id` should return 301 to HTTPS
2. **WebSocket**: `wss://aquamine.web.id/ws/realtime` should connect successfully
3. **Headers**: API logs should show correct client IPs
4. **Upload**: CV upload of 9MB file should succeed

## Environment Variables

Required for production deployment:

```bash
ENVIRONMENT=production
CORS_ORIGINS=https://aquamine.web.id
NEXT_PUBLIC_API_BASE_URL=https://aquamine.web.id
NEXT_PUBLIC_WS_BASE_URL=wss://aquamine.web.id
```
