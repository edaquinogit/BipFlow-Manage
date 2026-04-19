# ============================================================================
# BipFlow Environment Bootstrap for Windows PowerShell
# This script sets up the Python virtual environment and installs dependencies

param([switch]$Force = $false)

$ProjectRoot = Split-Path -Parent $PSCommandPath
$BackendDir = Join-Path $ProjectRoot "bipdelivery"
$VenvDir = Join-Path $BackendDir "venv"
$RequirementsFile = Join-Path $ProjectRoot "requirements.txt"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"

function Write-Header {
    param([string]$Message)
    Write-Host "`n$Message" -ForegroundColor Cyan -BackgroundColor Black
    Write-Host ("=" * 80) -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "OK $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "ERROR $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "INFO $Message" -ForegroundColor Blue
}

# Step 1: Validate Project Structure
Write-Header "Step 1: Validating Project Structure"

if (-not (Test-Path $ProjectRoot)) {
    Write-Error-Custom "Project root not found: $ProjectRoot"
    exit 1
}
Write-Success "Project root detected: $ProjectRoot"

if (-not (Test-Path $BackendDir)) {
    Write-Error-Custom "Backend directory not found: $BackendDir"
    exit 1
}
Write-Success "Backend directory detected: $BackendDir"

if (-not (Test-Path $RequirementsFile)) {
    Write-Error-Custom "requirements.txt not found at: $RequirementsFile"
    exit 1
}
Write-Success "requirements.txt detected: $RequirementsFile"

# Step 2: Virtual Environment Detection and Creation
Write-Header "Step 2: Virtual Environment Configuration"

if (Test-Path $VenvDir) {
    if ($Force) {
        Write-Warning-Custom "Force flag set. Removing existing venv..."
        Remove-Item $VenvDir -Recurse -Force
        Write-Info "Existing venv removed."
    }
    else {
        Write-Success "Virtual environment already exists: $VenvDir"
    }
}

if (-not (Test-Path $VenvDir)) {
    Write-Info "Creating new Python virtual environment..."
    & python -m venv $VenvDir

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Virtual environment created successfully"
    }
    else {
        Write-Error-Custom "Failed to create virtual environment"
        Write-Error-Custom "Ensure Python is installed and accessible"
        exit 1
    }
}

if (-not (Test-Path $PythonExe)) {
    Write-Error-Custom "Python executable not found in venv: $PythonExe"
    exit 1
}
Write-Success "venv Python executable verified: $PythonExe"

# Step 3: Activate Virtual Environment
Write-Header "Step 3: Activating Virtual Environment"

if (-not (Test-Path $ActivateScript)) {
    Write-Error-Custom "Activation script not found: $ActivateScript"
    exit 1
}

try {
    & $ActivateScript
    Write-Success "Virtual environment activated"
}
catch {
    Write-Error-Custom "Failed to activate virtual environment: $_"
    exit 1
}

# Verify activation
$ActivePython = & python --version 2>&1
Write-Info "Active Python: $ActivePython"

# Step 4: Upgrade pip
Write-Header "Step 4: Upgrading pip, setuptools, and wheel"

Write-Info "Running: python -m pip install --upgrade pip setuptools==78.0.1 wheel"
& python -m pip install --upgrade pip setuptools==78.0.1 wheel --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Success "pip and build tools upgraded"
}
else {
    Write-Error-Custom "Failed to upgrade pip"
    exit 1
}

# Step 5: Install Dependencies
Write-Header "Step 5: Installing Dependencies from requirements.txt"

Write-Info "Installing all packages from requirements.txt"
& pip install -r $RequirementsFile --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Success "All dependencies installed successfully"
}
else {
    Write-Error-Custom "Failed to install dependencies"
    exit 1
}

# Step 6: Validation and System Integrity Check
Write-Header "Step 6: Validation - System Integrity Check"

Write-Info "Checking Django installation..."
& python -c "import django; print('Django ' + str(django.VERSION))" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "Django is installed and importable"
}
else {
    Write-Error-Custom "Django import failed"
    exit 1
}

Write-Info "Checking additional dependencies..."
$packages = @("corsheaders", "dotenv", "PIL", "pytest", "pytest_django")
foreach ($pkg in $packages) {
    & python -c "import $pkg" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "$pkg is installed"
    }
    else {
        Write-Warning-Custom "$pkg is not installed"
    }
}

# Step 7: PYTHONPATH Verification
Write-Header "Step 7: PYTHONPATH Verification"

Write-Info "Checking PYTHONPATH configuration..."
$PythonPrefix = & python -c "import sys; print(sys.prefix)" 2>&1
Write-Info "Python prefix: $PythonPrefix"

if ($PythonPrefix -match "venv") {
    Write-Success "venv is correctly configured in PYTHONPATH"
}
else {
    Write-Warning-Custom "venv may not be in PYTHONPATH"
}

# Summary and Next Steps
Write-Header "Bootstrap Complete - Environment Ready"

Write-Success "Summary:"
Write-Host "  * Project Root: $ProjectRoot"
Write-Host "  * venv Location: $VenvDir"
Write-Host "  * Python Executable: $PythonExe"
Write-Host "  * Requirements File: $RequirementsFile"

Write-Info "Next Steps:"
Write-Host "  1. Start Django server: cd $BackendDir && python manage.py runserver"
Write-Host "  2. VS Code auto-detects venv via .vscode/settings.json"
Write-Host "  3. Run migrations: python manage.py migrate"
Write-Host ""

Write-Success "Enterprise-ready environment established"
