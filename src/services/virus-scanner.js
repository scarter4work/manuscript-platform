/**
 * Virus Scanner Service
 *
 * Provides file virus scanning using ClamAV for uploaded files.
 * Protects against malware, viruses, and malicious file uploads.
 *
 * Features:
 * - Scans files before storage
 * - Logs scan results to database
 * - Records security incidents for malware
 * - Graceful degradation if scanner unavailable
 * - Health monitoring for scanner service
 *
 * Issue #65: Implement File Virus Scanning for Uploads
 */

import NodeClam from 'clamscan';
import crypto from 'crypto';

let clamScan = null;
let scannerHealthy = false;
let lastHealthCheck = 0;

/**
 * Initialize ClamAV virus scanner
 *
 * @param {object} config - Scanner configuration
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function initVirusScanner(config = {}) {
  const host = config.CLAMAV_HOST || process.env.CLAMAV_HOST || 'localhost';
  const port = config.CLAMAV_PORT || process.env.CLAMAV_PORT || 3310;
  const enabled = config.VIRUS_SCANNER_ENABLED !== 'false';

  if (!enabled) {
    console.log('[VirusScanner] Scanning disabled via config');
    return false;
  }

  try {
    console.log(`[VirusScanner] Initializing ClamAV at ${host}:${port}...`);

    clamScan = await new NodeClam().init({
      clamdscan: {
        host,
        port: parseInt(port),
        timeout: 60000, // 1 minute timeout
        localFallback: false, // Don't fall back to local scanning
      },
      preference: 'clamdscan',
      debugMode: process.env.NODE_ENV === 'development',
    });

    // Test connection
    const version = await clamScan.getVersion();
    console.log('[VirusScanner] ClamAV initialized:', version);

    scannerHealthy = true;
    lastHealthCheck = Date.now();

    return true;
  } catch (error) {
    console.error('[VirusScanner] Failed to initialize:', error.message);
    scannerHealthy = false;

    if (process.env.NODE_ENV === 'production') {
      console.error('[VirusScanner] CRITICAL: Virus scanner unavailable in production!');
    }

    return false;
  }
}

/**
 * Check if virus scanner is available and healthy
 *
 * @returns {Promise<boolean>} True if scanner is ready
 */
export async function isScannerHealthy() {
  // Return cached status if checked recently (< 5 minutes)
  if (Date.now() - lastHealthCheck < 5 * 60 * 1000) {
    return scannerHealthy;
  }

  if (!clamScan) {
    return false;
  }

  try {
    await clamScan.getVersion();
    scannerHealthy = true;
    lastHealthCheck = Date.now();
    return true;
  } catch (error) {
    console.error('[VirusScanner] Health check failed:', error.message);
    scannerHealthy = false;
    return false;
  }
}

/**
 * Get scanner health information
 *
 * @returns {Promise<object>} Scanner health details
 */
export async function getScannerHealth() {
  if (!clamScan) {
    return {
      scanner: 'clamav',
      status: 'offline',
      error: 'Scanner not initialized',
      checkedAt: new Date().toISOString()
    };
  }

  try {
    const version = await clamScan.getVersion();

    return {
      scanner: 'clamav',
      status: 'online',
      version: version.trim(),
      checkedAt: new Date().toISOString(),
      healthy: true
    };
  } catch (error) {
    return {
      scanner: 'clamav',
      status: 'error',
      error: error.message,
      checkedAt: new Date().toISOString(),
      healthy: false
    };
  }
}

/**
 * Scan a file buffer for viruses
 *
 * @param {Buffer} buffer - File contents
 * @param {string} filename - Original filename
 * @param {object} options - Scan options
 * @returns {Promise<object>} Scan result
 */
export async function scanFile(buffer, filename, options = {}) {
  const scanId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[VirusScanner] Scanning file: ${filename} (${buffer.length} bytes) [${scanId}]`);

  // If scanner not initialized or unhealthy
  if (!clamScan || !(await isScannerHealthy())) {
    const failOpen = process.env.VIRUS_SCANNER_FAIL_OPEN === 'true' || process.env.NODE_ENV === 'development';

    if (failOpen) {
      console.warn(`[VirusScanner] Scanner unavailable, failing open (allowing upload) [${scanId}]`);
      return {
        scanId,
        isInfected: false,
        scanStatus: 'skipped',
        warning: 'Scanner unavailable',
        duration: Date.now() - startTime
      };
    } else {
      console.error(`[VirusScanner] Scanner unavailable, failing closed (blocking upload) [${scanId}]`);
      throw new Error('Virus scanner unavailable. Upload blocked for security.');
    }
  }

  try {
    // Scan the buffer using ClamAV stream scanning
    const { isInfected, viruses } = await clamScan.scanStream(buffer);

    const duration = Date.now() - startTime;

    if (isInfected) {
      console.error(`[VirusScanner] 🚨 INFECTED FILE DETECTED: ${filename} [${scanId}]`, viruses);

      return {
        scanId,
        isInfected: true,
        scanStatus: 'infected',
        viruses: viruses || [],
        filename,
        fileSize: buffer.length,
        duration,
        scannedAt: new Date().toISOString(),
        action: 'blocked'
      };
    }

    console.log(`[VirusScanner] ✓ Clean file: ${filename} (scanned in ${duration}ms) [${scanId}]`);

    return {
      scanId,
      isInfected: false,
      scanStatus: 'clean',
      filename,
      fileSize: buffer.length,
      duration,
      scannedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[VirusScanner] Scan error for ${filename} [${scanId}]:`, error);

    const failOpen = process.env.VIRUS_SCANNER_FAIL_OPEN === 'true' || process.env.NODE_ENV === 'development';

    if (failOpen) {
      console.warn(`[VirusScanner] Scan failed, failing open (allowing upload) [${scanId}]`);
      return {
        scanId,
        isInfected: false,
        scanStatus: 'error',
        error: error.message,
        warning: 'Scan failed, file allowed',
        duration: Date.now() - startTime
      };
    } else {
      console.error(`[VirusScanner] Scan failed, failing closed (blocking upload) [${scanId}]`);
      throw new Error(`Virus scan failed: ${error.message}`);
    }
  }
}

/**
 * Log scan result to database
 *
 * @param {object} db - Database adapter
 * @param {object} scanResult - Scan result from scanFile()
 * @param {string} userId - User ID who uploaded the file
 * @param {string} fileKey - Storage key where file is/will be stored
 * @returns {Promise<void>}
 */
export async function logScanResult(db, scanResult, userId = null, fileKey = null) {
  try {
    const scanRecordId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO file_scan_results (
        id, file_key, file_name, file_size, scan_status, scanner_name,
        viruses_found, scan_duration_ms, scanned_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      scanRecordId,
      fileKey || 'unknown',
      scanResult.filename || 'unknown',
      scanResult.fileSize || 0,
      scanResult.scanStatus,
      'clamav',
      scanResult.viruses ? JSON.stringify(scanResult.viruses) : null,
      scanResult.duration || 0,
      timestamp,
      userId
    ).run();

    console.log(`[VirusScanner] Scan result logged: ${scanRecordId}`);
  } catch (error) {
    console.error('[VirusScanner] Failed to log scan result:', error);
    // Don't throw - logging failure shouldn't block the upload workflow
  }
}

/**
 * Create security incident for malware detection
 *
 * @param {object} db - Database adapter
 * @param {object} scanResult - Scan result with isInfected=true
 * @param {string} userId - User ID who uploaded the file
 * @param {string} ipAddress - IP address of uploader
 * @returns {Promise<string>} Incident ID
 */
export async function createMalwareIncident(db, scanResult, userId = null, ipAddress = null) {
  try {
    const incidentId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    const details = {
      filename: scanResult.filename,
      fileSize: scanResult.fileSize,
      viruses: scanResult.viruses,
      scanId: scanResult.scanId,
      scannedAt: scanResult.scannedAt
    };

    await db.prepare(`
      INSERT INTO security_incidents (
        id, type, details, ip_address, user_id, created_at, resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      incidentId,
      'malware_upload_blocked',
      JSON.stringify(details),
      ipAddress,
      userId,
      timestamp,
      0 // Not resolved
    ).run();

    console.error(`[VirusScanner] 🚨 Security incident created: ${incidentId}`);

    return incidentId;
  } catch (error) {
    console.error('[VirusScanner] Failed to create security incident:', error);
    throw error;
  }
}

/**
 * Update scanner health in database
 *
 * @param {object} db - Database adapter
 * @returns {Promise<void>}
 */
export async function updateScannerHealth(db) {
  try {
    const health = await getScannerHealth();
    const healthId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    // Calculate average scan time from recent scans
    const stats = await db.prepare(`
      SELECT AVG(scan_duration_ms) as avg_scan_time
      FROM file_scan_results
      WHERE scanned_at > ?
      LIMIT 100
    `).bind(timestamp - 3600).first(); // Last hour

    await db.prepare(`
      INSERT INTO scanner_health (
        id, scanner_name, status, virus_definitions_version,
        last_successful_scan, checked_at, response_time_ms, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      healthId,
      'clamav',
      health.status,
      health.version || 'unknown',
      health.healthy ? timestamp : null,
      timestamp,
      stats?.avg_scan_time || null,
      health.error || null
    ).run();

    console.log(`[VirusScanner] Health status updated: ${health.status}`);
  } catch (error) {
    console.error('[VirusScanner] Failed to update health status:', error);
    // Don't throw - health logging failure shouldn't disrupt scanning
  }
}

/**
 * EICAR test string for testing virus scanner
 * This is a safe test pattern that all antivirus scanners detect
 */
export const EICAR_TEST_STRING = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * Create EICAR test file buffer
 *
 * @returns {Buffer} EICAR test file buffer
 */
export function createEICarTestFile() {
  return Buffer.from(EICAR_TEST_STRING);
}

/**
 * Test virus scanner with EICAR file
 *
 * @returns {Promise<boolean>} True if scanner correctly detects EICAR
 */
export async function testScanner() {
  console.log('[VirusScanner] Running EICAR test...');

  const testFile = createEICarTestFile();
  const result = await scanFile(testFile, 'eicar-test.txt');

  if (result.isInfected) {
    console.log('[VirusScanner] ✓ EICAR test PASSED: Scanner correctly detected test malware');
    return true;
  } else {
    console.error('[VirusScanner] ✗ EICAR test FAILED: Scanner did not detect test malware');
    return false;
  }
}

export default {
  initVirusScanner,
  isScannerHealthy,
  getScannerHealth,
  scanFile,
  logScanResult,
  createMalwareIncident,
  updateScannerHealth,
  testScanner,
  EICAR_TEST_STRING,
  createEICarTestFile
};
