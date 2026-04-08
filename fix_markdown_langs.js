const fs = require('fs');
const path = require('path');

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

function detectLanguage(codeBlock) {
  const code = codeBlock.toLowerCase();

  // Bash
  if (/cd |npm |pip |python |git |rm |mkdir|chmod|\.\/bootstrap|venv|node |npm run/.test(code)) {
    return 'bash';
  }

  // Python
  if (/import |from |def |class |lambda|@property|pytest|django|logger/.test(code)) {
    return 'python';
  }

  // TypeScript
  if (/interface |async |=>|export |Logger\.|useToast/.test(code)) {
    return 'typescript';
  }

  // JSON
  if ((/^\{|\[/.test(code.trim()) || /['"]\s*:\s*/.test(code)) && /"/.test(code)) {
    return 'json';
  }

  // Environment
  if (/VITE_|DATABASE_|_API_|\.env/.test(code)) {
    return 'env';
  }

  // PowerShell
  if (/\.ps1|Activate\.ps1|\$/.test(code.substring(0, 50))) {
    return 'powershell';
  }

  // Plaintext for output/status
  if (/✅|✓|✗|❌|pass rate|error:|---/.test(code)) {
    return 'plaintext';
  }

  return 'text';
}

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return `SKIP: ${filePath} - not found`;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  const lines = content.split('\n');
  let i = 0;
  const output = [];
  let fixed = false;

  while (i < lines.length) {
    const line = lines[i];

    // Check for code fence without language
    if (line.trim() === '```') {
      i++;
      const codeLines = [];

      // Collect code until closing fence
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }

      if (i < lines.length) {
        // Found closing fence
        const codeText = codeLines.join('\n').trim();
        if (codeText) {
          const lang = detectLanguage(codeText);
          output.push('```' + lang);
          fixed = true;
        } else {
          output.push('```');
        }

        codeLines.forEach(l => output.push(l));
        output.push('```');
      } else {
        output.push('```');
        codeLines.forEach(l => output.push(l));
      }
    } else {
      output.push(line);
    }

    i++;
  }

  const newContent = output.join('\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return `FIXED: ${filePath}`;
  }

  return `OK: ${filePath}`;
}

console.log('='.repeat(60));
console.log('Markdown Language Specifier Fixer (MD040)');
console.log('='.repeat(60));

let fixedCount = 0;

FILES.forEach(file => {
  const msg = fixFile(file);
  console.log(msg);
  if (msg.startsWith('FIXED')) {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}/${FILES.length}`);
console.log('='.repeat(60));
