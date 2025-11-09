import fs from 'fs/promises';
import path from 'path';

/**
 * Migration script: Replace direct R2 bucket access with env.R2.getBucket() pattern
 *
 * Replaces:
 *   env.MANUSCRIPTS_RAW.get(key)         → env.R2.getBucket('manuscripts_raw').get(key)
 *   env.MANUSCRIPTS_PROCESSED.put(...)   → env.R2.getBucket('manuscripts_processed').put(...)
 *   env.MARKETING_ASSETS.delete(key)     → env.R2.getBucket('marketing_assets').delete(key)
 *   env.BACKUPS.list()                   → env.R2.getBucket('backups').list()
 */

const replacements = [
  {
    // Match with or without trailing dot (for method calls and parameter passing)
    pattern: /(this\.)?env\.MANUSCRIPTS_RAW(?=\.|,|\)|\s)/g,
    replacement: (match) => match.startsWith('this.')
      ? "this.env.R2.getBucket('manuscripts_raw')"
      : "env.R2.getBucket('manuscripts_raw')",
    name: 'MANUSCRIPTS_RAW'
  },
  {
    pattern: /(this\.)?env\.MANUSCRIPTS_PROCESSED(?=\.|,|\)|\s)/g,
    replacement: (match) => match.startsWith('this.')
      ? "this.env.R2.getBucket('manuscripts_processed')"
      : "env.R2.getBucket('manuscripts_processed')",
    name: 'MANUSCRIPTS_PROCESSED'
  },
  {
    pattern: /(this\.)?env\.MARKETING_ASSETS(?=\.|,|\)|\s)/g,
    replacement: (match) => match.startsWith('this.')
      ? "this.env.R2.getBucket('marketing_assets')"
      : "env.R2.getBucket('marketing_assets')",
    name: 'MARKETING_ASSETS'
  },
  {
    pattern: /(this\.)?env\.BACKUPS(?=\.|,|\)|\s)/g,
    replacement: (match) => match.startsWith('this.')
      ? "this.env.R2.getBucket('backups')"
      : "env.R2.getBucket('backups')",
    name: 'BACKUPS'
  }
];

async function migrateFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    const changes = [];

    for (const { pattern, replacement, name } of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        changes.push(`${name}: ${matches.length} occurrences`);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, changes };
    }

    return { success: true, changes: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function findFilesToMigrate(directory) {
  const files = [];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath);
        }
      } else if (entry.name.endsWith('.js')) {
        // Check if file contains R2 references
        const content = await fs.readFile(fullPath, 'utf-8');
        if (content.includes('env.MANUSCRIPTS_RAW') ||
            content.includes('env.MANUSCRIPTS_PROCESSED') ||
            content.includes('env.MARKETING_ASSETS') ||
            content.includes('env.BACKUPS.') ||
            content.includes('this.env.MANUSCRIPTS_RAW') ||
            content.includes('this.env.MANUSCRIPTS_PROCESSED') ||
            content.includes('this.env.MARKETING_ASSETS') ||
            content.includes('this.env.BACKUPS')) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(directory);
  return files;
}

async function main() {
  console.log('🔍 Scanning for files with R2 bucket references...\n');

  const srcDir = path.join(process.cwd(), 'src');
  const files = await findFilesToMigrate(srcDir);

  console.log(`📋 Found ${files.length} files to migrate:\n`);

  let totalChanges = 0;
  let filesMigrated = 0;

  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    process.stdout.write(`   ${relativePath}... `);

    const result = await migrateFile(filePath);

    if (result.success) {
      if (result.changes.length > 0) {
        console.log('✅ MIGRATED');
        result.changes.forEach(change => {
          console.log(`      - ${change}`);
        });
        filesMigrated++;
        totalChanges += result.changes.length;
      } else {
        console.log('⏭️  No changes needed');
      }
    } else {
      console.log(`❌ ERROR: ${result.error}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Migration Complete`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files migrated: ${filesMigrated}`);
  console.log(`Files unchanged: ${files.length - filesMigrated}`);
  console.log(`\n📝 Next Steps:`);
  console.log(`1. Review changes: git diff src/`);
  console.log(`2. Test locally: npm start`);
  console.log(`3. Commit: git commit -am "feat: migrate R2 storage to env.R2.getBucket() pattern"`);
}

main().catch(console.error);
