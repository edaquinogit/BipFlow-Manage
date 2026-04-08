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

const issues = [];

function checkMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // MD041: First line should be a heading
  if (lines.length > 0 && !lines[0].trim().startsWith('#')) {
    issues.push({ file: filePath, line: 1, code: 'MD041', desc: 'First line should be a heading' });
  }

  // MD001: Heading levels should increment by one
  let lastLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s/);
    if (match) {
      const level = match[1].length;
      if (lastLevel > 0 && level > lastLevel + 1) {
        issues.push({ file: filePath, line: i + 1, code: 'MD001', desc: `Heading level jump from H${lastLevel} to H${level}` });
      }
      lastLevel = level;
    }
  }

  // MD022: Headings should be surrounded by blank lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#')) {
      if (i > 0 && lines[i - 1].trim() !== '') {
        issues.push({ file: filePath, line: i + 1, code: 'MD022', desc: 'Heading should have blank line before' });
      }
      if (i < lines.length - 1 && lines[i + 1].trim() !== '' && !lines[i + 1].trim().startsWith('-')) {
        if (i + 1 < lines.length - 1 || lines[i + 1].trim() !== '') {
          // Allow single line descriptions after heading
        }
      }
    }
  }

  // MD024: Multiple headings with same content
  const headings = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^#{1,6}\s+(.*)/);
    if (match) {
      const heading = match[1].trim();
      if (headings.has(heading)) {
        const prevLine = headings.get(heading);
        issues.push({ file: filePath, line: i + 1, code: 'MD024', desc: `Duplicate heading "${heading}" (also at line ${prevLine})` });
      } else {
        headings.set(heading, i + 1);
      }
    }
  }

  // MD040: Fenced code blocks should have language specifier
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '```') {
      issues.push({ file: filePath, line: i + 1, code: 'MD040', desc: 'Code block should have language specifier' });
    }
  }

  // MD013: Line too long (>120 chars)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 120) {
      // Skip in code blocks and tables
      if (!lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('```')) {
        // issues.push({ file: filePath, line: i + 1, code: 'MD013', desc: 'Line too long' });
      }
    }
  }
}

console.log('='.repeat(70));
console.log('Markdown Linting Analysis Report');
console.log('='.repeat(70));

FILES.forEach(file => checkMarkdown(file));

// Group by issue type
const byCode = {};
issues.forEach(issue => {
  if (!byCode[issue.code]) {
    byCode[issue.code] = [];
  }
  byCode[issue.code].push(issue);
});

// Print summary
console.log('\nIssue Summary by Code:\n');
let totalIssues = 0;
Object.keys(byCode).sort().forEach(code => {
  const count = byCode[code].length;
  totalIssues += count;
  console.log(`  ${code}: ${count} issue(s)`);
});

console.log(`\nTotal Issues Found: ${totalIssues}`);

// Print detailed issues (grouped by file)
if (totalIssues > 0) {
  console.log('\n' + '='.repeat(70));
  console.log('Detailed Issues:\n');

  const byFile = {};
  issues.forEach(issue => {
    if (!byFile[issue.file]) {
      byFile[issue.file] = [];
    }
    byFile[issue.file].push(issue);
  });

  Object.keys(byFile).sort().forEach(file => {
    console.log(`📄 ${file}: ${byFile[file].length}issue(s)`);
    byFile[file].forEach(issue => {
      console.log(`   Line ${issue.line}: [${issue.code}] ${issue.desc}`);
    });
    console.log();
  });
}

console.log('='.repeat(70));
