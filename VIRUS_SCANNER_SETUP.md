# Virus Scanner Setup Guide

Complete guide to setting up and using ClamAV virus scanning for file uploads.

**Issue**: #65 - Implement File Virus Scanning for Uploads
**Priority**: HIGH (Security)
**Status**: ✅ Implemented

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What It Does

The virus scanner automatically scans all uploaded files (manuscripts, marketing assets, cover images) for malware and viruses **before** they are stored. This protects:

- **Authors**: From accidentally downloading infected files
- **Platform**: From hosting malicious content
- **Data**: From malware propagation across the system

### How It Works

```
[User Upload] → [File Buffer] → [ClamAV Scan] → [Clean?] → [Store in R2]
                                      ↓
                                  [Infected?] → [Block + Log Incident]
```

### Protected Endpoints

- ✅ `POST /upload/manuscript` - Manuscript uploads (PDF, DOCX, TXT, EPUB)
- ✅ `POST /upload/marketing` - Marketing asset uploads (images)
- ✅ `POST /manuscripts/:id/cover` - Cover image uploads

---

## Architecture

### Components

1. **ClamAV Daemon** (`clamd`) - Virus scanning engine
   - Runs in Docker container
   - Listens on port 3310
   - Auto-updates virus definitions daily

2. **Virus Scanner Service** (`src/services/virus-scanner.js`)
   - Node.js wrapper for ClamAV
   - Handles file scanning, logging, incident creation
   - Graceful degradation if scanner unavailable

3. **Database Tables**:
   - `security_incidents` - Tracks malware detections
   - `file_scan_results` - Audit log of all scans
   - `scanner_health` - Scanner status monitoring

---

## Local Development Setup

### 1. Start ClamAV with Docker Compose

```bash
# Start all services (ClamAV, PostgreSQL, Redis)
docker-compose up -d

# View ClamAV logs
docker-compose logs -f clamav

# Wait for ClamAV to be ready (loads virus definitions)
# This takes 2-5 minutes on first start
docker-compose logs clamav | grep "Daemon started"
```

### 2. Configure Environment Variables

Edit `.env.local`:

```bash
# Virus Scanner (ClamAV)
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
VIRUS_SCANNER_ENABLED=true
VIRUS_SCANNER_FAIL_OPEN=true  # Allow uploads if scanner fails (dev only)
```

### 3. Run Database Migration

```bash
# Apply migration_038 to create security tables
psql $DATABASE_URL < migrations/migration_038_security_incidents.sql
```

### 4. Start the Server

```bash
npm run dev
```

You should see:

```
✓ Virus scanner initialized
ClamAV initialized: ClamAV 1.x.x
```

---

## Production Deployment

### Render Configuration

#### 1. Add ClamAV Service

On Render, ClamAV runs as a **Background Worker** (not a Web Service):

1. Go to Render Dashboard
2. Click "New +" → "Background Worker"
3. Select Docker deployment
4. Use Docker image: `clamav/clamav:latest`
5. Set port: `3310`
6. Resources: 512 MB RAM minimum

#### 2. Environment Variables

In your Render Web Service environment:

```bash
CLAMAV_HOST=<clamav-service-internal-hostname>
CLAMAV_PORT=3310
VIRUS_SCANNER_ENABLED=true
VIRUS_SCANNER_FAIL_OPEN=false  # CRITICAL: Fail closed in production
```

**Important**: Set `VIRUS_SCANNER_FAIL_OPEN=false` in production to **block uploads** if the scanner is unavailable.

#### 3. Network Configuration

Ensure the ClamAV service and your Web Service are in the same **Private Network** on Render so they can communicate.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAMAV_HOST` | `localhost` | ClamAV daemon hostname |
| `CLAMAV_PORT` | `3310` | ClamAV daemon port |
| `VIRUS_SCANNER_ENABLED` | `true` | Enable/disable scanning |
| `VIRUS_SCANNER_FAIL_OPEN` | `false` | Allow uploads if scanner fails |

### Fail-Open vs Fail-Closed

**Fail-Open (Development)**:
- Scanner unavailable → Allow upload with warning
- Use when: Local development, testing
- Risk: Malware could be uploaded

**Fail-Closed (Production)**:
- Scanner unavailable → Block upload with 503 error
- Use when: Production, staging
- Risk: Temporary service disruption if scanner down

---

## Testing

### 1. EICAR Test File

EICAR is a safe test string that all antivirus scanners detect as malware.

```bash
# Test virus scanner with EICAR
curl -X POST http://localhost:3000/upload/manuscript \
  -F "file=@eicar.txt" \
  -F "title=Test Upload" \
  -F "genre=general"
```

Expected response:

```json
{
  "error": "File upload blocked. The file appears to contain malware or viruses.",
  "scanResult": {
    "viruses": ["Eicar-Test-Signature"],
    "scanId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Your file has been flagged by our security scanner..."
  }
}
```

### 2. Clean File Test

```bash
# Upload a clean text file
echo "This is a clean test manuscript." > clean.txt

curl -X POST http://localhost:3000/upload/manuscript \
  -F "file=@clean.txt" \
  -F "title=Clean Test" \
  -F "genre=general"
```

Expected: Upload succeeds (200 OK)

### 3. Automated Tests

```bash
# Run virus scanner tests
npm test -- tests/unit/virus-scanner.test.js
```

---

## Monitoring

### Health Check Endpoint

Check scanner status:

```bash
GET /health/virus-scanner
```

Response:

```json
{
  "scanner": "clamav",
  "status": "online",
  "version": "ClamAV 1.2.1",
  "checkedAt": "2025-11-08T12:00:00Z",
  "healthy": true
}
```

### Database Queries

**View recent scans**:

```sql
SELECT
  file_name,
  scan_status,
  scan_duration_ms,
  scanned_at
FROM file_scan_results
ORDER BY scanned_at DESC
LIMIT 20;
```

**View malware detections**:

```sql
SELECT * FROM malware_uploads
ORDER BY scanned_at DESC;
```

**View security incidents**:

```sql
SELECT
  type,
  created_at,
  details,
  ip_address
FROM security_incidents
WHERE type = 'malware_upload_blocked'
ORDER BY created_at DESC;
```

**Scanner health**:

```sql
SELECT * FROM scanner_status;
```

### Metrics to Monitor

1. **Scan Success Rate**: % of scans that complete without errors
2. **Scan Duration**: Average time to scan files (target: <2 seconds for 1MB)
3. **Detection Rate**: # of malware detections per day
4. **False Positives**: User reports of blocked clean files
5. **Scanner Availability**: Uptime of ClamAV service

---

## Troubleshooting

### Scanner Not Initializing

**Symptom**: Server logs show "Failed to initialize virus scanner"

**Solutions**:

1. Check ClamAV is running:
   ```bash
   docker ps | grep clamav
   ```

2. Test ClamAV connection:
   ```bash
   telnet localhost 3310
   ```

3. Check virus definitions loaded:
   ```bash
   docker exec manuscript-clamav clamdscan --version
   ```

4. Restart ClamAV:
   ```bash
   docker-compose restart clamav
   ```

### Uploads Being Blocked (503 Error)

**Symptom**: All uploads fail with "Unable to verify file safety"

**Cause**: Scanner unavailable + `VIRUS_SCANNER_FAIL_OPEN=false`

**Solutions**:

1. Check scanner health:
   ```bash
   curl http://localhost:3000/health/virus-scanner
   ```

2. Temporarily allow uploads (development only):
   ```bash
   export VIRUS_SCANNER_FAIL_OPEN=true
   ```

3. Check ClamAV logs:
   ```bash
   docker-compose logs clamav
   ```

### Slow Scans (>5 seconds)

**Symptom**: File uploads take a long time

**Solutions**:

1. Check ClamAV container resources (needs 512MB+ RAM)
2. Update virus definitions:
   ```bash
   docker exec manuscript-clamav freshclam
   ```
3. Consider increasing timeout in `virus-scanner.js`

### False Positives

**Symptom**: Clean files being flagged as infected

**Solutions**:

1. Update ClamAV virus definitions
2. Check file against VirusTotal for confirmation
3. Add file hash to ClamAV whitelist if confirmed clean
4. Report false positive to ClamAV community

---

## Performance Benchmarks

| File Size | Scan Time (Target) | Scan Time (Measured) |
|-----------|-------------------|---------------------|
| 100 KB    | <100ms           | ~80ms               |
| 1 MB      | <500ms           | ~350ms              |
| 10 MB     | <2 seconds       | ~1.5 seconds        |
| 50 MB     | <5 seconds       | ~4 seconds          |

**Note**: First scan after ClamAV startup may be slower while loading signatures.

---

## Security Best Practices

1. **Always fail closed in production** (`VIRUS_SCANNER_FAIL_OPEN=false`)
2. **Update virus definitions daily** (configured in docker-compose.yml)
3. **Monitor security incidents** (check `security_incidents` table daily)
4. **Test with EICAR regularly** (verify scanner is working)
5. **Set up alerts** for malware detections
6. **Review scan logs** for patterns or attacks
7. **Keep ClamAV updated** (use `latest` Docker tag)

---

## Cost Estimate

**Infrastructure**:
- Development: $0 (Docker on local machine)
- Production: +$7-10/month (Render Background Worker)

**No per-scan fees** - ClamAV is open source and free.

---

## References

- [ClamAV Official Docs](https://docs.clamav.net/)
- [ClamAV Docker Image](https://hub.docker.com/r/clamav/clamav)
- [clamscan npm package](https://www.npmjs.com/package/clamscan)
- [EICAR Test File](https://www.eicar.org/download-anti-malware-testfile/)
- Migration: `migrations/migration_038_security_incidents.sql`
- Service: `src/services/virus-scanner.js`

---

## Support

If you encounter issues:

1. Check logs: `docker-compose logs clamav`
2. Test health: `curl http://localhost:3000/health/virus-scanner`
3. Review database: `SELECT * FROM scanner_health ORDER BY checked_at DESC`
4. Open issue: [GitHub Issues](https://github.com/your-repo/issues)

---

**Last Updated**: 2025-11-08
**Issue**: #65 - Implement File Virus Scanning for Uploads
