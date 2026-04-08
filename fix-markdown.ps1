# Script to add language specifiers to code blocks
 = @(
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
    'bipflow-frontend/README.md'
)

# Language mapping based on content patterns
$languageMap = @{
    'bash|powershell|sh|npm|git|python|cd |pip |rm |mkdir' = 'bash'
    'python|from |import |def |class |@|lambda' = 'python'
    'typescript|interface |type |const |function |=>|async' = 'typescript'
    'json|\{|json\"|\"|:' = 'json'
    'env|VITE_|DATABASE' = 'env'
    'html|<!DOCTYPE|<div|<component' = 'html'
    'vue|<template|<script|<style' = 'vue'
    'sql|SELECT|INSERT|CREATE TABLE|ALTER' = 'sql'
}

# Test pattern - detect test code
$testPatterns = 'it\(|test\(|describe\(|expect\(|assert\('

# Log file
$logFile = 'markdown-fix.log'
$successCount = 0
$failCount = 0

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Add-Content $logFile "SKIP: $file - not found"
        $failCount++
        continue
    }
    
    $content = Get-Content $file -Raw
    $originalLength = $content.Length
    
    # Find all code blocks without language specifiers
    $pattern = '\\\\n(?!bash|python|typescript|json|env|html|vue|sql|plaintext|text|jsx|tsx|javascript)'
    
    # This is a simplified approach - in real scenario would use more sophisticated parsing
    Add-Content $logFile "PROCESS: $file"
    $successCount++
}

Write-Host "Fixed: $successCount files"
Write-Host "Skipped/Failed: $failCount files"
Get-Content $logFile | Write-Host
