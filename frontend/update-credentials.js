const fs = require('fs');

const content = fs.readFileSync('dashboard-spa.js', 'utf8');

// Pattern 1: fetch calls with just URL - add options object with credentials
let updated = content.replace(
  /const response = await fetch\((`[^`]+`)\);/g,
  (match, url) => {
    return `const response = await fetch(${url}, {\n                credentials: 'include'\n            });`;
  }
);

// Pattern 2: fetch calls with options object - add credentials if not present
updated = updated.replace(
  /fetch\((`[^`]+`),\s*\{/g,
  (match, url) => {
    // Check if the full match context already has credentials
    return match; // Will handle manually in next pass
  }
);

// Write separate patterns for different fetch call types
// First, handle all simple fetch calls (just URL)
updated = content.replace(
  /await fetch\((`\$\{this\.API_BASE\}[^`]*`)\);/g,
  `await fetch($1, {\n                credentials: 'include'\n            });`
);

// Now handle fetch calls that already have method but no credentials
updated = updated.replace(
  /fetch\((`[^`]+`),\s*\{\s*method:/g,
  `fetch($1, {\n                credentials: 'include',\n                method:`
);

// Handle fetch calls that have headers but no credentials
updated = updated.replace(
  /fetch\((`[^`]+`),\s*\{\s*headers:/g,
  `fetch($1, {\n                credentials: 'include',\n                headers:`
);

fs.writeFileSync('dashboard-spa.js', updated);
console.log('Updated dashboard-spa.js with credentials: include');
