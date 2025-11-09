import fs from 'fs/promises';
import path from 'path';

/**
 * Migration script: Replace Cloudflare Queue bindings with Redis queue service
 *
 * Replaces:
 *   await env.ANALYSIS_QUEUE.send({...})  → await env.QUEUE.send('analysis', {...})
 *   await env.ASSET_GENERATION_QUEUE.send({...}) → await env.QUEUE.send('asset-generation', {...})
 */

const replacements = [
  {
    pattern: /env\.ANALYSIS_QUEUE\.send\(/g,
    replacement: "env.QUEUE.send('analysis', ",
    name: 'ANALYSIS_QUEUE'
  },
  {
    pattern: /env\.ASSET_GENERATION_QUEUE\.send\(/g,
    replacement: "env.QUEUE.send('asset-generation', ",
    name: 'ASSET_GENERATION_QUEUE'
  },
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
        // Check if file contains queue references
        const content = await fs.readFile(fullPath, 'utf-8');
        if (content.includes('ANALYSIS_QUEUE.send') ||
            content.includes('ASSET_GENERATION_QUEUE.send')) {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(directory);
  return files;
}

async function main() {
  console.log('🔍 Scanning for files with Queue bindings...\\n');

  const srcDir = path.join(process.cwd(), 'src');
  const files = await findFilesToMigrate(srcDir);

  console.log(`📋 Found ${files.length} files to migrate:\\n`);

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

  console.log(`\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Migration Complete`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files migrated: ${filesMigrated}`);
  console.log(`Files unchanged: ${files.length - filesMigrated}`);
  console.log(`\\n📝 Next Steps:`);
  console.log(`1. Review changes: git diff src/`);
  console.log(`2. Update queue consumer worker to use env.QUEUE.getNextJob()`);
  console.log(`3. Test locally: npm start`);
  console.log(`4. Commit: git commit -am "feat: migrate Cloudflare Queue to Redis queue service"`);
}

main().catch(console.error);
