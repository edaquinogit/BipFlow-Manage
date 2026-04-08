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

function fixMarkdownComprehensive(filePath) {
  if (!fs.existsSync(filePath)) {
    return { status: 'SKIP', file: filePath };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let lines = content.split('\n');
  let changed = false;

  // ====== FIX 1: Detect and add language to code blocks (MD040) ======
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      // Code fence without language
      let codeText = '';
      let j = i + 1;

      while (j < lines.length && lines[j].trim() !== '```') {
        codeText += lines[j] + '\n';
        j++;
      }

      // Detect language
      let lang = detectLanguage(codeText);
      if (lang && lang !== '') {
        lines[i] = '```' + lang;
        changed = true;
      }
    }
  }

  // ====== FIX 2: Add blank lines before headings (MD022) ======
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('#')) {
      if (i > 0 && lines[i - 1].trim() !== '') {
        // Insert blank line
        lines.splice(i, 0, '');
        i++;
        changed = true;
      }
    }
  }

  // ====== FIX 3: Fix heading level jumps - make them sequential (MD001) ======
  // Find first heading level used
  let firstHeadingLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s/);
    if (match) {
      firstHeadingLevel = match[1].length;
      break;
    }
  }

  if (firstHeadingLevel !== 1) {
    // Convert to start at H1
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})(\s)/);
      if (match) {
        const currentLevel = match[1].length;
        const offset = firstHeadingLevel - 1;
        const newLevel = Math.max(1, currentLevel - offset);
        lines[i] = '#'.repeat(newLevel) + match[2] + lines[i].substring(match[1].length + 1);
        changed = true;
      }
    }
  }

  // Recompute content
  let newContent = lines.join('\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { status: 'FIXED', file: filePath };
  }

  return { status: 'OK', file: filePath };
}

function detectLanguage(codeBlock) {
  const code = codeBlock.toLowerCase();

  if (/cd |npm |pip |python |git |rm |mkdir|chmod|\.\/bootstrap|venv|node |npm run|powershell|\.ps1|activate|manage\.py|pytest/.test(code)) {
    return 'bash';
  }
  if (/import |from |def |class |lambda|@property|pytest|django|logger|py_compile/.test(code)) {
    return 'python';
  }
  if (/interface |async |=>|export |logger\.|usetoast|const |function |typescript/.test(code)) {
    return 'typescript';
  }
  if ((code.trim().startsWith('{') || code.trim().startsWith('[')) && /"/.test(code)) {
    return 'json';
  }
  if (/vite_|database_|_api_|\.env/.test(code)) {
    return 'env';
  }
  if (/✅|✓|✗|❌|pass rate|error:|test|---/.test(code)) {
    return 'plaintext';
  }

  return 'text';
}

console.log('='.repeat(60));
console.log('Comprehensive Markdown Fixer');
console.log('(MD040, MD022, MD001)');
console.log('='.repeat(60));

let fixedCount = 0;
const results = [];

FILES.forEach(file => {
  const result = fixMarkdownComprehensive(file);
  results.push(result);
  console.log(`${result.status}: ${result.file}`);
  if (result.status === 'FIXED') {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}/${FILES.length}`);
console.log('='.repeat(60));
