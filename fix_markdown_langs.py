#!/usr/bin/env python3
"""
Fix markdown code blocks by adding language specifiers
MD040 linting issue fixer
"""

import re
from pathlib import Path

# Files to process
FILES = [
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
]

def detect_language(code_block):
    """Detect code language from content"""
    code = code_block.lower()

    # Bash patterns
    if any(p in code for p in ['cd ', 'npm ', 'pip ', 'python ', 'git ', 'rm ', 'mkdir', 'chmod', './bootstrap', 'venv', 'node ', 'npm run']):
        return 'bash'

    # Python patterns
    if any(p in code for p in ['import ', 'from ', 'def ', 'class ', 'lambda', '@property', 'pytest', 'django', 'logger']):
        return 'python'

    # TypeScript/Vue patterns
    if any(p in code for p in ['interface ', 'async ', '=>', 'export ', 'Logger.', 'useToast']):
        return 'typescript'

    # JSON patterns
    if (code.strip().startswith('{') or code.strip().startswith('[')) and '\"' in code:
        return 'json'

    # Environment file
    if any(p in code for p in ['VITE_', 'DATABASE_', '_API_', '.env']):
        return 'env'

    # PowerShell
    if '.ps1' in code or 'Activate.ps1' in code or '$' in code[:50]:
        return 'powershell'

    # Default to plaintext for output/status
    if any(p in code for p in ['✅', '✓', '✗', '❌', 'pass rate', 'test', 'error:', '---']):
        return 'plaintext'

    return 'text'

def fix_markdown_file(file_path):
    """Fix a single markdown file"""
    if not Path(file_path).exists():
        return f'SKIP: {file_path} - not found', False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')

    i = 0
    output_lines = []
    fixed = False

    while i < len(lines):
        line = lines[i]

        # Check if this is a code fence start
        if line.strip() == '```':
            # No language specifier - need to add one
            i += 1
            code_lines = []

            # Collect code until closing fence
            while i < len(lines) and lines[i].strip() != '```':
                code_lines.append(lines[i])
                i += 1

            if i < len(lines):
                # Found closing fence
                code_text = '\n'.join(code_lines).strip()
                if code_text:  # Only process non-empty blocks
                    lang = detect_language(code_text)
                    output_lines.append(f'```{lang}')
                    fixed = True
                else:
                    output_lines.append('```')

                output_lines.extend(code_lines)
                output_lines.append('```')  # closing fence
            else:
                # Malformed - no closing fence
                output_lines.append('```')
                output_lines.extend(code_lines)
        else:
            output_lines.append(line)

        i += 1

    new_content = '\n'.join(output_lines)

    if new_content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return f'FIXED: {file_path}', True
    else:
        return f'OK: {file_path}', False

def main():
    """Main function"""
    print("=" * 60)
    print("Markdown Language Specifier Fixer (MD040)")
    print("=" * 60)

    fixed_count = 0

    for file_path in FILES:
        msg, was_fixed = fix_markdown_file(file_path)
        print(msg)
        if was_fixed:
            fixed_count += 1

    print("=" * 60)
    print(f"Total files fixed: {fixed_count}/{len(FILES)}")
    print("=" * 60)

if __name__ == '__main__':
    main()
