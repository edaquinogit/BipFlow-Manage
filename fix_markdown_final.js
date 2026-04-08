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

function fixRemainingIssues(filePath) {
  if (!fs.existsSync(filePath)) {
    return { status: 'SKIP', file: filePath };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let lines = content.split('\n');
  let changed = false;

  // ====== FIX MD041: Ensure file starts with heading ======
  if (lines.length > 0 && !lines[0].trim().startsWith('#')) {
    // Try to fix by finding first heading and making it first
    let firstHeadingIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].trim().startsWith('#')) {
        firstHeadingIdx = i;
        break;
      }
    }

    if (firstHeadingIdx > 0) {
      // Move heading to front
      const heading = lines.splice(firstHeadingIdx, 1)[0];
      lines.unshift(heading);
      lines.unshift(''); // Add blank line after
      changed = true;
    }
  }

  // ====== FIX MD001: Normalize heading levels ======
  const headingMap = {}; // Map to track heading levels
  let minLevel = 6;
  let maxLevel = 1;
  const headingLines = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s/);
    if (match) {
      const level = match[1].length;
      minLevel = Math.min(minLevel, level);
      maxLevel = Math.max(maxLevel, level);
      headingLines.push({ idx: i, level, text: lines[i] });
    }
  }

  // If there are heading level jumps, fix them
  if (headingLines.length > 1) {
    let lastLevel = headingLines[0].level;

    for (let i = 1; i < headingLines.length; i++) {
      const currentLevel = headingLines[i].level;

      // Check for jump > 1
      if (currentLevel > lastLevel + 1) {
        // Fix by reducing the level jump
        const targetLevel = lastLevel + 1;
        const hashes = '#'.repeat(targetLevel);
        const text = lines[headingLines[i].idx].replace(/^#{1,6}\s/, hashes + ' ');
        lines[headingLines[i].idx] = text;
        headingLines[i].level = targetLevel;
        changed = true;
      }

      lastLevel = headingLines[i].level;
    }
  }

  // ====== FIX MD024: Rename duplicate headings ======
  const headingCounts = {};
  const seenHeadings = {};

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1];
      const text = match[2].trim();
      const key = `${level}|${text}`;

      if (!seenHeadings[key]) {
        seenHeadings[key] = [];
      }
      seenHeadings[key].push(i);
    }
  }

  // For duplicates, add context suffix
  Object.keys(seenHeadings).forEach(key => {
    const indices = seenHeadings[key];
    if (indices.length > 1) {
      indices.forEach((idx, duplicateNum) => {
        if (duplicateNum > 0) {
          lines[idx] = lines[idx] + ` (${duplicateNum})`;
          changed = true;
        }
      });
    }
  });

  // Recompute content
  let newContent = lines.join('\n');

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { status: 'FIXED', file: filePath };
  }

  return { status: 'OK', file: filePath };
}

console.log('='.repeat(60));
console.log('Markdown Final Fixes');
console.log('(MD001, MD024, MD041)');
console.log('='.repeat(60));

let fixedCount = 0;

FILES.forEach(file => {
  const result = fixRemainingIssues(file);
  console.log(`${result.status}: ${result.file}`);
  if (result.status === 'FIXED') {
    fixedCount++;
  }
});

console.log('='.repeat(60));
console.log(`Total files fixed: ${fixedCount}/${FILES.length}`);
console.log('='.repeat(60));
