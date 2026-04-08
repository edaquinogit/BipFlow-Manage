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

function fixBlankLinesAroundCode(filePath) {
  if (!fs.existsSync(filePath)) {
    return `SKIP: ${filePath} - not found`;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  const lines = content.split('\n');
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // If this is a code fence start
    if (trimmed.startsWith('```')) {
      // Check if previous line is blank
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        // Previous line is not blank - add one
        output.push('');
      }

      output.push(line);

      // Find the closing fence
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith('```')) {
        output.push(lines[j]);
        j++;
      }

      // Add closing fence
      if (j < lines.length) {
        output.push(lines[j]);

        // Check if next line should be blank
        if (j + 1 < lines.length && lines[j + 1].trim() !== '' && !lines[j + 1].trim().startsWith('#') && !lines[j + 1].trim().startsWith('-')) {
          output.push('');
        }
      }

      // Skip to after closing fence
      i = j;
    } else {
      output.push(line);
    }
  }

  const newContent = output.join('\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return `FIXED: ${filePath}`;
  }

  return `OK: ${filePath}`;
}

console.log('='.repeat(60));
console.log('Markdown Blank Lines Fixer (MD031)');
console.log('='.repeat(60));

let fixedCount = 0;

FILES.forEach(file => {
  const msg = fixBlankLinesAroundCode(file);
  console.log(msg);
  if (msg.startsWith('FIXED')) {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}/${FILES.length}`);
console.log('='.repeat(60));
