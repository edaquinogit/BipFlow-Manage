const fs = require('fs');

const FILES = [
  'README.md',
  'AI_CONTEXT.md',
  'RESOLUTION_SUMMARY.md',
  'COMMIT_MESSAGES.md',
  'INTEGRATION.md',
  'FINAL_VALIDATION_COMMANDS.md',
  'TEST_INTEGRATION_GUIDE.md',
  'CHANGELOG.md',
  'PRE_FLIGHT_REPORT.md',
  'ATOMIC_EXECUTION_COMPLETE.md',
  'docs/README.md',
  'docs/architecture/system-overview.md',
  'bipflow-frontend/README.md',
];

function removeExtraBlankLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return `SKIP: ${filePath} - not found`;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace 3+ consecutive newlines with 2 newlines
  let newContent = content.replace(/\n\n\n+/g, '\n\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return `FIXED: ${filePath}`;
  }

  return `OK: ${filePath}`;
}

console.log('='.repeat(60));
console.log('Markdown Multiple Blank Lines Fixer (MD012)');
console.log('='.repeat(60));

let fixedCount = 0;

FILES.forEach(file => {
  const msg = removeExtraBlankLines(file);
  console.log(msg);
  if (msg.startsWith('FIXED')) {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}/${FILES.length}`);
console.log('='.repeat(60));
