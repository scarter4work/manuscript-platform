# 🔒 SECURITY: Implement File Virus Scanning for Uploads

## Priority: HIGH (Security)
**Impact**: Malware uploads possible, no scanning protection
**Effort**: 6-8 hours
**Risk**: Security vulnerability, data breach vector

## Problem

File uploads (manuscripts, marketing assets, cover images) are NOT scanned for viruses or malware. This is a documented security gap from `CLAUDE.md:162`.

**Current Risk**:
- Malicious files can be uploaded
- Stored manuscripts may contain malware
- Downloaded files could infect users
- No protection against supply chain attacks

**Attack Vectors**:
1. Malicious DOCX with macro viruses
2. PDF with embedded malware
3. Image files with steganography payloads
4. ZIP bombs (compression attacks)

## Current State

```markdown
# CLAUDE.md:162-167
**Production TODO**:
- Rate limiting (implemented with Redis) ✅
- File virus scanning ❌
- API key rotation ❌
- Enhanced data encryption
- GDPR compliance
```

No virus scanning is implemented in:
- `POST /upload/manuscript`
- `POST /upload/marketing`
- `POST /manuscripts/:id/cover`

## Recommended Solution: ClamAV

**ClamAV** is open-source, Docker-compatible, and free.

### Architecture

```
[Express Upload] → [Scan with ClamAV] → [Store if clean] → [Delete if infected]
```

### Option 1: ClamAV Docker Container (Recommended)

**Setup**:
```yaml
# docker-compose.yml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"
    volumes:
      - clamav-data:/var/lib/clamav
    environment:
      - CLAMAV_NO_FRESHCLAM=false  # Auto-update virus definitions
```

**Cost**: Free + ~$5/month Render resources

### Implementation

```javascript
// src/services/virus-scanner.js
import NodeClam from 'clamscan';

let clamScan;

export async function initVirusScanner() {
  clamScan = await new NodeClam().init({
    clamdscan: {
      host: process.env.CLAMAV_HOST || 'localhost',
      port: process.env.CLAMAV_PORT || 3310,
      timeout: 60000, // 1 minute
    },
    preference: 'clamdscan'
  });

  console.log('[VirusScanner] ClamAV initialized');
}

export async function scanFile(buffer, filename) {
  if (!clamScan) {
    console.warn('[VirusScanner] Scanner not initialized, skipping scan');
    return { isInfected: false, warning: 'Scanner unavailable' };
  }

  try {
    const { isInfected, viruses } = await clamScan.scanStream(buffer);

    if (isInfected) {
      console.error(`[VirusScanner] INFECTED FILE: ${filename}`, viruses);
      return {
        isInfected: true,
        viruses: viruses,
        action: 'blocked'
      };
    }

    return {
      isInfected: false,
      scannedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('[VirusScanner] Scan error:', error);
    // Fail open or fail closed?
    if (process.env.NODE_ENV === 'production') {
      // Fail closed in production
      throw new Error('Virus scan failed. Upload blocked for security.');
    } else {
      // Fail open in development
      return { isInfected: false, warning: 'Scan failed' };
    }
  }
}
```

### Update Upload Handlers

```javascript
// src/handlers/manuscript-handlers.js
import { scanFile } from '../services/virus-scanner.js';

export async function handleManuscriptUpload(request, env) {
  // ... existing code to get file buffer ...

  // Scan for viruses
  const scanResult = await scanFile(fileBuffer, fileName);

  if (scanResult.isInfected) {
    // Log incident
    await env.DB.prepare(`
      INSERT INTO security_incidents (type, details, ip_address, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      'malware_upload_blocked',
      JSON.stringify({ filename: fileName, viruses: scanResult.viruses }),
      request.headers.get('CF-Connecting-IP'),
      Math.floor(Date.now() / 1000)
    ).run();

    return new Response(JSON.stringify({
      error: 'File upload blocked. The file appears to contain malware.',
      scanResult: scanResult.viruses
    }), { status: 400 });
  }

  // Continue with upload...
}
```

## Alternative: VirusTotal API

For lower upload volumes (<500/day):

```javascript
import axios from 'axios';

async function scanWithVirusTotal(buffer, filename) {
  const formData = new FormData();
  formData.append('file', buffer, filename);

  const response = await axios.post(
    'https://www.virustotal.com/api/v3/files',
    formData,
    {
      headers: {
        'x-apikey': process.env.VIRUSTOTAL_API_KEY
      }
    }
  );

  return response.data;
}
```

**Cost**: Free (4 requests/minute) or $10/month (500 requests/minute)

## Testing Checklist

- [ ] Test with EICAR test file (safe malware test signature)
- [ ] Test with clean files (DOCX, PDF, TXT, EPUB)
- [ ] Test with large files (50MB+)
- [ ] Test upload timeout (scan takes 30+ seconds)
- [ ] Test ClamAV connection failure (graceful degradation)
- [ ] Test virus definition updates (freshclam)
- [ ] Load test: 100 concurrent uploads
- [ ] Verify infected files are NOT stored
- [ ] Verify security incidents are logged

## EICAR Test File

```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

This is a safe test string that triggers all antivirus scanners.

## Database Schema

```sql
-- Track malware upload attempts
CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'malware_upload_blocked', 'suspicious_activity', etc.
  details TEXT,  -- JSON
  ip_address TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  resolved INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_security_incidents_type ON security_incidents(type);
CREATE INDEX idx_security_incidents_created ON security_incidents(created_at);
```

## Environment Variables

```bash
# .env.local
CLAMAV_HOST=localhost
CLAMAV_PORT=3310
VIRUS_SCANNER_ENABLED=true
VIRUS_SCANNER_FAIL_OPEN=false  # Fail closed in production
```

## Files to Modify

1. `src/services/virus-scanner.js` (NEW)
2. `src/handlers/manuscript-handlers.js` (add scanning)
3. `src/handlers/asset-handlers.js` (add scanning)
4. `package.json` (add clamscan dependency)
5. `server.js` (initialize scanner on startup)
6. `migrations/migration_038_security_incidents.sql` (NEW)
7. `docker-compose.yml` (add ClamAV service if using Docker)

## Acceptance Criteria

- [ ] All file uploads are scanned before storage
- [ ] Infected files are blocked with HTTP 400
- [ ] Security incidents are logged to database
- [ ] ClamAV virus definitions auto-update daily
- [ ] Performance: Scan 1MB file in <2 seconds
- [ ] Graceful degradation if scanner unavailable
- [ ] Admin dashboard shows blocked uploads
- [ ] Tests pass with EICAR test file

## Deployment Strategy

1. **Week 1**: Set up ClamAV on Render staging
2. **Week 1**: Implement scanner service + tests
3. **Week 2**: Add to upload handlers
4. **Week 2**: Test with EICAR + real uploads
5. **Week 3**: Production deployment
6. **Monitor**: Scan times, blocked uploads, false positives

## Cost Estimate

**ClamAV (Recommended)**:
- Infrastructure: +$5-10/month (Render container)
- No per-scan fees
- Open source, no licensing

**VirusTotal API**:
- Free: 4 requests/minute (insufficient for production)
- $10/month: 500 requests/minute (covers ~15k uploads/month)

## Related Issues

- Part of security hardening roadmap
- Required before accepting paid subscriptions
- Compliance requirement for data protection

## References

- Security TODO: `CLAUDE.md:162`
- ClamAV: https://www.clamav.net/
- Node.js wrapper: https://www.npmjs.com/package/clamscan
- VirusTotal API: https://developers.virustotal.com/reference/overview