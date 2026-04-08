const fs = require('fs');

const DUPLICATES_TO_FIX = [
  { file: 'README.md', heading: 'Backend', newName: 'Backend (Technology Stack)' },
  { file: 'README.md', heading: 'Frontend', newName: 'Frontend (Technology Stack)' },
  { file: 'README.md', heading: 'Contributing', newName: 'Contributing Guidelines' },
  { file: 'README.md', heading: 'License', newName: 'License Information' },

  { file: 'AI_CONTEXT.md', heading: '❌ Forbidden Patterns', newName: '❌ Forbidden Patterns (Testing)' },
  { file: 'AI_CONTEXT.md', heading: '✅ GOOD', newName: '✅ GOOD (Examples)' },
  { file: 'AI_CONTEXT.md', heading: '3. Test locally:', newName: '3. Test locally: (Pre-commit)' },
  { file: 'AI_CONTEXT.md', heading: '4. Run linting:', newName: '4. Run linting: (Pre-commit)' },
  { file: 'AI_CONTEXT.md', heading: '5. Run tests:', newName: '5. Run tests: (Pre-commit)' },

  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Expected Output', newName: 'Expected Output (Vitest)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Test Files', newName: 'Test Files (E2E)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Install dependencies', newName: 'Install dependencies (Cypress)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Run specific test file', newName: 'Run specific test file (Pattern)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Run with coverage', newName: 'Run with coverage (Report)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Output: coverage/', newName: 'Output: coverage/ (Report)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Vitest Unit Tests', newName: 'Vitest Unit Tests (Additional)' },
  { file: 'TEST_INTEGRATION_GUIDE.md', heading: 'Cypress E2E Tests', newName: 'Cypress E2E Tests (Additional)' },
];

function fixDuplicateHeadings(filePath, headingMap) {
  if (!fs.existsSync(filePath)) {
    return { status: 'SKIP', file: filePath };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let lines = content.split('\n');
  const seen = {};
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1];
      const text = match[2].trim();
      const key = `${level}|${text}`;

      if (!seen[key]) {
        seen[key] = 0;
      }
      seen[key]++;

      // Check if this heading needs to be renamed
      const lookupKey = text; // Strip leading emoji symbols
      const replacement = headingMap[lookupKey];

      if (replacement && seen[key] > 1) {
        // This is a duplicate - rename it
        lines[i] = level + ' ' + replacement;
        changed = true;
      }
    }
  }

  let newContent = lines.join('\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { status: 'FIXED', file: filePath };
  }

  return { status: 'OK', file: filePath };
}

console.log('='.repeat(60));
console.log('Markdown Duplicate Heading Fixer (MD024)');
console.log('='.repeat(60));

const fileGroups = {};

DUPLICATES_TO_FIX.forEach(item => {
  if (!fileGroups[item.file]) {
    fileGroups[item.file] = {};
  }
  fileGroups[item.file][item.heading] = item.newName;
});

let fixedCount = 0;

Object.keys(fileGroups).forEach(file => {
  const result = fixDuplicateHeadings(file, fileGroups[file]);
  console.log(`${result.status}: ${result.file}`);
  if (result.status === 'FIXED') {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}`);
console.log('='.repeat(60));
