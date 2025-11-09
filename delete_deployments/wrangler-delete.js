const { execSync } = require('child_process');
const fs = require('fs');

const PROJECT_NAME = process.env.CF_PAGES_PROJECT_NAME || 'manuscript-platform';
const BATCH_SIZE = 50; // Process in batches to avoid overwhelming the API

console.log(`Starting deletion of deployments for project: ${PROJECT_NAME}`);
console.log('This will use wrangler\'s authentication...\n');

// Function to get all deployment IDs using wrangler
function getAllDeploymentIds() {
  console.log('Fetching deployment list...');

  try {
    // Run wrangler command and capture output
    const output = execSync(
      `npx wrangler pages deployment list --project-name=${PROJECT_NAME}`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse the table output to extract deployment IDs
    // Format: │ 6d02faa4-41b0-4a96-8e46-a9e0138f54cc │ ...
    const lines = output.split('\n');
    const deploymentIds = [];

    for (const line of lines) {
      // Look for lines with UUID format (8-4-4-4-12 characters)
      const match = line.match(/│\s+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\s+│/);
      if (match) {
        deploymentIds.push(match[1]);
      }
    }

    console.log(`Found ${deploymentIds.length} deployments\n`);
    return deploymentIds;
  } catch (error) {
    console.error('Error fetching deployments:', error.message);
    return [];
  }
}

// Function to find production deployment ID
function getProductionDeploymentId() {
  try {
    const output = execSync(
      `npx wrangler pages project list`,
      { encoding: 'utf8' }
    );

    // We'll mark the most recent one as production (first in list)
    // In practice, we want to keep at least one deployment
    return null; // For now, let's delete all except the last one
  } catch (error) {
    console.error('Error finding production deployment:', error.message);
    return null;
  }
}

// Function to delete a deployment using direct API call
function deleteDeployment(deploymentId, accountId, apiToken) {
  console.log(`Deleting deployment: ${deploymentId}`);

  try {
    const result = execSync(
      `curl -s -X DELETE "https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}" ` +
      `-H "Authorization: Bearer ${apiToken}"`,
      { encoding: 'utf8' }
    );

    const response = JSON.parse(result);
    if (response.success) {
      console.log(`✓ Deleted deployment ${deploymentId}`);
      return true;
    } else {
      console.error(`✗ Failed to delete ${deploymentId}:`, response.errors);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error deleting ${deploymentId}:`, error.message);
    return false;
  }
}

// Function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
async function main() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error('Error: CF_ACCOUNT_ID and CF_API_TOKEN environment variables are required');
    process.exit(1);
  }

  // Get all deployment IDs
  const deploymentIds = getAllDeploymentIds();

  if (deploymentIds.length === 0) {
    console.log('No deployments found to delete');
    return;
  }

  // Keep the most recent deployment (first one in the list)
  const toKeep = deploymentIds[0];
  const toDelete = deploymentIds.slice(1);

  console.log(`Keeping most recent deployment: ${toKeep}`);
  console.log(`Deleting ${toDelete.length} deployments...\n`);

  // Delete in batches
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < toDelete.length; i++) {
    const deploymentId = toDelete[i];
    const success = deleteDeployment(deploymentId, accountId, apiToken);

    if (success) {
      deleted++;
    } else {
      failed++;
    }

    // Rate limit: wait 500ms between requests
    if (i < toDelete.length - 1) {
      await sleep(500);
    }

    // Progress update every 10 deletions
    if ((i + 1) % 10 === 0) {
      console.log(`\nProgress: ${i + 1}/${toDelete.length} processed (${deleted} deleted, ${failed} failed)\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Deletion complete!`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
  console.log(`Kept: 1 (most recent)`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
