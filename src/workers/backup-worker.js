/**
 * Automated Database Backup Worker
 * Scheduled to run daily at 3 AM UTC
 * Exports D1 database to R2 for disaster recovery
 */

/**
 * Scheduled handler for automated backups
 * Triggered by CRON: "0 3 * * *" (daily at 3 AM UTC)
 */
export async function handleScheduledBackup(env) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const backupDate = timestamp.split('T')[0]; // YYYY-MM-DD

  console.log(`[Backup] Starting database backup: ${timestamp}`);

  try {
    // Step 1: Export D1 database to SQL
    console.log('[Backup] Exporting D1 database...');
    const exportResult = await exportD1ToSQL(env.DB);

    if (!exportResult.success) {
      throw new Error(`Database export failed: ${exportResult.error}`);
    }

    const sqlDump = exportResult.sql;
    const dumpSize = new Blob([sqlDump]).size;
    console.log(`[Backup] Export complete: ${dumpSize} bytes`);

    // Step 2: Compress backup
    console.log('[Backup] Compressing backup...');
    const compressed = await compressData(sqlDump);
    const compressedSize = compressed.byteLength;
    const compressionRatio = ((1 - compressedSize / dumpSize) * 100).toFixed(2);
    console.log(`[Backup] Compression complete: ${compressedSize} bytes (${compressionRatio}% reduction)`);

    // Step 3: Generate backup filename
    const filename = `backup-${backupDate}-${Date.now()}.sql.gz`;

    // Step 4: Upload to R2
    console.log(`[Backup] Uploading to R2: ${filename}`);
    await env.R2.getBucket('backups').put(filename, compressed, {
      httpMetadata: {
        contentType: 'application/gzip',
      },
      customMetadata: {
        backupDate: backupDate,
        backupTimestamp: timestamp,
        originalSize: dumpSize.toString(),
        compressedSize: compressedSize.toString(),
        compressionRatio: compressionRatio,
        backupType: 'daily',
      },
    });

    // Step 5: Log backup statistics
    const stats = await getBackupStats(env.DB);
    const duration = Date.now() - startTime;

    console.log(`[Backup] Backup complete:`, {
      filename,
      duration: `${duration}ms`,
      originalSize: `${dumpSize} bytes`,
      compressedSize: `${compressedSize} bytes`,
      compressionRatio: `${compressionRatio}%`,
      tables: stats.tables,
      totalRows: stats.totalRows,
    });

    // Step 6: Clean up old backups (retention policy)
    await cleanupOldBackups(env.R2.getBucket('backups'));

    // Step 7: Record backup in database
    await recordBackupLog(env.DB, {
      filename,
      backupDate,
      timestamp,
      originalSize: dumpSize,
      compressedSize,
      duration,
      status: 'success',
      stats,
    });

    return {
      success: true,
      filename,
      duration,
      stats,
    };

  } catch (error) {
    console.error('[Backup] Backup failed:', error);

    // Record failure in database
    try {
      await recordBackupLog(env.DB, {
        filename: `backup-${backupDate}-failed`,
        backupDate,
        timestamp,
        status: 'failed',
        error: error.message,
      });
    } catch (logError) {
      console.error('[Backup] Failed to log backup failure:', logError);
    }

    // In production, this should trigger an alert
    // TODO: Send alert email to admin

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Export D1 database to SQL format
 * Uses SQLite .dump equivalent
 */
async function exportD1ToSQL(db) {
  try {
    // Get all tables
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_cf_%'
      ORDER BY name
    `).all();

    let sqlDump = `-- Database Backup\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Platform: Manuscript Publishing Platform\n\n`;

    sqlDump += `PRAGMA foreign_keys=OFF;\n`;
    sqlDump += `BEGIN TRANSACTION;\n\n`;

    // Export each table
    for (const table of tables.results) {
      const tableName = table.name;

      // Get table schema
      const schemaResult = await db.prepare(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name=?
      `).bind(tableName).first();

      sqlDump += `-- Table: ${tableName}\n`;
      sqlDump += `DROP TABLE IF EXISTS ${tableName};\n`;
      sqlDump += `${schemaResult.sql};\n\n`;

      // Get table data
      const rows = await db.prepare(`SELECT * FROM ${tableName}`).all();

      if (rows.results.length > 0) {
        // Get column names
        const columns = Object.keys(rows.results[0]);
        const columnList = columns.join(', ');

        for (const row of rows.results) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'number') return value;
            // Escape single quotes in strings
            return `'${String(value).replace(/'/g, "''")}'`;
          }).join(', ');

          sqlDump += `INSERT INTO ${tableName} (${columnList}) VALUES (${values});\n`;
        }
        sqlDump += `\n`;
      }
    }

    // Export indexes
    const indexes = await db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='index'
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
      ORDER BY name
    `).all();

    if (indexes.results.length > 0) {
      sqlDump += `-- Indexes\n`;
      for (const index of indexes.results) {
        sqlDump += `${index.sql};\n`;
      }
      sqlDump += `\n`;
    }

    sqlDump += `COMMIT;\n`;
    sqlDump += `PRAGMA foreign_keys=ON;\n`;

    return {
      success: true,
      sql: sqlDump,
    };

  } catch (error) {
    console.error('[Backup] Database export error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Compress data using gzip
 */
async function compressData(data) {
  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(data);

  // Create gzip stream
  const compressionStream = new CompressionStream('gzip');
  const writer = compressionStream.writable.getWriter();
  writer.write(uint8Array);
  writer.close();

  // Read compressed data
  const reader = compressionStream.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Get database statistics for backup logging
 */
async function getBackupStats(db) {
  const tables = await db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_cf_%'
  `).all();

  const stats = {
    tables: [],
    totalRows: 0,
  };

  for (const table of tables.results) {
    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).first();
    const rowCount = countResult.count;

    stats.tables.push({
      name: table.name,
      rows: rowCount,
    });
    stats.totalRows += rowCount;
  }

  return stats;
}

/**
 * Clean up old backups based on retention policy
 * Retention: 30 daily, 12 monthly, 7 yearly
 */
async function cleanupOldBackups(backupsBucket) {
  try {
    console.log('[Backup] Cleaning up old backups...');

    // List all backups
    const list = await backupsBucket.list();
    const backups = list.objects.map(obj => ({
      key: obj.key,
      uploaded: obj.uploaded,
      metadata: obj.customMetadata,
    }));

    const now = new Date();
    const backupsToDelete = [];

    // Retention logic
    for (const backup of backups) {
      const backupDate = new Date(backup.uploaded);
      const ageInDays = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));

      // Keep all backups less than 30 days old (daily retention)
      if (ageInDays < 30) continue;

      // Keep one backup per month for backups 30-365 days old (12 monthly)
      if (ageInDays < 365) {
        const backupMonth = backupDate.getMonth();
        const backupYear = backupDate.getFullYear();

        // Check if we already have a backup for this month
        const hasMonthlyBackup = backups.some(b => {
          const d = new Date(b.uploaded);
          return d.getMonth() === backupMonth &&
                 d.getFullYear() === backupYear &&
                 b.key !== backup.key &&
                 d < backupDate; // Keep the oldest backup of the month
        });

        if (!hasMonthlyBackup) continue;
      }

      // Keep one backup per year for backups > 365 days (7 yearly)
      if (ageInDays >= 365) {
        const backupYear = backupDate.getFullYear();
        const currentYear = now.getFullYear();

        // Only keep backups from the last 7 years
        if (currentYear - backupYear > 7) {
          backupsToDelete.push(backup.key);
          continue;
        }

        // Check if we already have a backup for this year
        const hasYearlyBackup = backups.some(b => {
          const d = new Date(b.uploaded);
          return d.getFullYear() === backupYear &&
                 b.key !== backup.key &&
                 d < backupDate; // Keep the oldest backup of the year
        });

        if (!hasYearlyBackup) continue;
      }

      backupsToDelete.push(backup.key);
    }

    // Delete old backups
    if (backupsToDelete.length > 0) {
      console.log(`[Backup] Deleting ${backupsToDelete.length} old backups`);
      for (const key of backupsToDelete) {
        await backupsBucket.delete(key);
      }
    } else {
      console.log('[Backup] No old backups to delete');
    }

  } catch (error) {
    console.error('[Backup] Cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't fail the backup
  }
}

/**
 * Record backup attempt in database log
 */
async function recordBackupLog(db, logEntry) {
  try {
    // Create backup_logs table if it doesn't exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id TEXT PRIMARY KEY,
        filename TEXT,
        backup_date TEXT,
        timestamp TEXT,
        original_size INTEGER,
        compressed_size INTEGER,
        duration INTEGER,
        status TEXT,
        error TEXT,
        stats TEXT,
        created_at INTEGER
      )
    `).run();

    // Insert log entry
    await db.prepare(`
      INSERT INTO backup_logs (
        id, filename, backup_date, timestamp,
        original_size, compressed_size, duration,
        status, error, stats, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `log_${Date.now()}`,
      logEntry.filename,
      logEntry.backupDate,
      logEntry.timestamp,
      logEntry.originalSize || null,
      logEntry.compressedSize || null,
      logEntry.duration || null,
      logEntry.status,
      logEntry.error || null,
      logEntry.stats ? JSON.stringify(logEntry.stats) : null,
      Math.floor(Date.now() / 1000)
    ).run();

    console.log('[Backup] Log entry recorded');
  } catch (error) {
    console.error('[Backup] Failed to record log:', error);
    // Don't throw - logging failure shouldn't fail the backup
  }
}

/**
 * Restore database from backup
 * WARNING: This will overwrite the current database!
 */
export async function restoreFromBackup(env, backupFilename) {
  console.log(`[Restore] Starting restore from: ${backupFilename}`);

  try {
    // Step 1: Download backup from R2
    const backup = await env.R2.getBucket('backups').get(backupFilename);
    if (!backup) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Step 2: Decompress
    const compressed = await backup.arrayBuffer();
    const decompressed = await decompressData(compressed);

    // Step 3: Parse SQL and execute
    const sqlStatements = decompressed.split(';').filter(s => s.trim());

    for (const statement of sqlStatements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        await env.DB.prepare(trimmed).run();
      }
    }

    console.log('[Restore] Restore complete');
    return { success: true };

  } catch (error) {
    console.error('[Restore] Restore failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Decompress gzipped data
 */
async function decompressData(compressedData) {
  const decompressionStream = new DecompressionStream('gzip');
  const writer = decompressionStream.writable.getWriter();
  writer.write(new Uint8Array(compressedData));
  writer.close();

  const reader = decompressionStream.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('');
}
