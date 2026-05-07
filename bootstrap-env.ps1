# ============================================================================
# BipFlow Environment Bootstrap for Windows PowerShell
# This script sets up the Python virtual environment and installs dependencies

param(
    [switch]$Force = $false,
    [string]$PythonVersion = "3.12"
)

$ProjectRoot = Split-Path -Parent $PSCommandPath
$BackendDir = Join-Path $ProjectRoot "bipdelivery"
$FrontendDir = Join-Path $ProjectRoot "bipflow-frontend"
$VenvDir = Join-Path $BackendDir "venv"
$RequirementsFile = Join-Path $ProjectRoot "requirements.txt"
$RootPackageFile = Join-Path $ProjectRoot "package.json"
$FrontendPackageFile = Join-Path $FrontendDir "package.json"
$FrontendEnvExample = Join-Path $FrontendDir ".env.example"
$FrontendEnvFile = Join-Path $FrontendDir ".env.local"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$PythonVersionPattern = "^$([regex]::Escape($PythonVersion))\."

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

function Get-PythonDetails {
    param(
        [string]$Command,
        [string[]]$Arguments = @()
    )

    try {
        $PythonDetailsScript = "import sys; print(sys.executable); print('.'.join(map(str, sys.version_info[:3])))"
        $Output = & $Command @Arguments -c $PythonDetailsScript 2>&1
        $OutputLines = [string[]](([string]($Output -join "`n")) -split "\r?\n")
        $OutputLines = $OutputLines | Where-Object { $_.Trim().Length -gt 0 }

        if ($LASTEXITCODE -ne 0 -or $OutputLines.Count -lt 2) {
            return $null
        }

        return [pscustomobject]@{
            Command = $Command
            Arguments = $Arguments
            Executable = [string]$OutputLines[0]
            Version = [string]$OutputLines[1]
        }
    }
    catch {
        return $null
    }
}

function Test-RequiredPythonVersion {
    param([string]$Version)
    return $Version -match $PythonVersionPattern
}

function Resolve-ProjectPython {
    Write-Info "Resolving Python $PythonVersion interpreter"

    $LauncherCandidate = Get-PythonDetails -Command "py" -Arguments @("-$PythonVersion")
    if ($null -ne $LauncherCandidate -and (Test-RequiredPythonVersion $LauncherCandidate.Version)) {
        Write-Success "Python $($LauncherCandidate.Version) detected: $($LauncherCandidate.Executable)"
        return $LauncherCandidate
    }
    elseif ($null -ne $LauncherCandidate) {
        Write-Warning-Custom "py -$PythonVersion returned Python $($LauncherCandidate.Version): $($LauncherCandidate.Executable)"
    }

    $PathCandidate = Get-PythonDetails -Command "python"
    if ($null -ne $PathCandidate -and (Test-RequiredPythonVersion $PathCandidate.Version)) {
        Write-Success "Python $($PathCandidate.Version) detected: $($PathCandidate.Executable)"
        return $PathCandidate
    }
    elseif ($null -ne $PathCandidate) {
        Write-Warning-Custom "python from PATH is Python $($PathCandidate.Version): $($PathCandidate.Executable)"
    }

    Write-Error-Custom "Python $PythonVersion.x is required for this project"
    Write-Info "Docker uses python:3.12-slim, so local bootstrap must use the same minor version"
    Write-Info "Installed Python versions reported by py launcher:"
    & py -0p 2>&1
    exit 1
}

function Get-VenvPythonVersion {
    if (-not (Test-Path $PythonExe)) {
        return $null
    }

    $Version = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return [string]$Version
}

function Remove-ProjectVenv {
    $ResolvedBackendDir = [System.IO.Path]::GetFullPath($BackendDir).TrimEnd('\')
    $ResolvedVenvDir = [System.IO.Path]::GetFullPath($VenvDir).TrimEnd('\')
    $ExpectedVenvDir = [System.IO.Path]::GetFullPath((Join-Path $ResolvedBackendDir "venv")).TrimEnd('\')

    if ($ResolvedVenvDir -ne $ExpectedVenvDir) {
        Write-Error-Custom "Refusing to remove unexpected venv path: $ResolvedVenvDir"
        exit 1
    }

    if (-not $ResolvedVenvDir.StartsWith($ResolvedBackendDir, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Error-Custom "Refusing to remove venv outside backend directory: $ResolvedVenvDir"
        exit 1
    }

    for ($Attempt = 1; $Attempt -le 3; $Attempt++) {
        try {
            Remove-Item -LiteralPath $ResolvedVenvDir -Recurse -Force -ErrorAction Stop

            if (-not (Test-Path -LiteralPath $ResolvedVenvDir)) {
                return
            }

            throw "venv directory still exists after removal attempt"
        }
        catch {
            if ($Attempt -eq 3) {
                Write-Error-Custom "Failed to remove existing venv: $_"
                Write-Info "Close terminals, Django servers, tests, and VS Code Python sessions using bipdelivery\venv, then rerun .\bootstrap-env.ps1 -Force"
                exit 1
            }

            Write-Warning-Custom "Could not remove venv yet; retrying..."
            Start-Sleep -Seconds $Attempt
        }
    }
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

if (-not (Test-Path $FrontendDir)) {
    Write-Error-Custom "Frontend directory not found: $FrontendDir"
    exit 1
}
Write-Success "Frontend directory detected: $FrontendDir"

if (-not (Test-Path $RequirementsFile)) {
    Write-Error-Custom "requirements.txt not found at: $RequirementsFile"
    exit 1
}
Write-Success "requirements.txt detected: $RequirementsFile"

if (-not (Test-Path $RootPackageFile)) {
    Write-Error-Custom "Root package.json not found at: $RootPackageFile"
    exit 1
}
Write-Success "Root package.json detected: $RootPackageFile"

if (-not (Test-Path $FrontendPackageFile)) {
    Write-Error-Custom "Frontend package.json not found at: $FrontendPackageFile"
    exit 1
}
Write-Success "Frontend package.json detected: $FrontendPackageFile"

# Step 2: Virtual Environment Detection and Creation
Write-Header "Step 2: Virtual Environment Configuration"

$ProjectPython = Resolve-ProjectPython

if (Test-Path $VenvDir) {
    $VenvPythonVersion = Get-VenvPythonVersion

    if ($Force) {
        Write-Warning-Custom "Force flag set. Removing existing venv..."
        Remove-ProjectVenv
        Write-Info "Existing venv removed."
    }
    elseif ($null -eq $VenvPythonVersion) {
        Write-Error-Custom "Existing venv is incomplete or corrupted: $VenvDir"
        Write-Info "Run .\bootstrap-env.ps1 -Force to recreate it with Python $PythonVersion.x"
        exit 1
    }
    elseif (-not (Test-RequiredPythonVersion $VenvPythonVersion)) {
        Write-Error-Custom "Existing venv uses Python $VenvPythonVersion, but this project requires Python $PythonVersion.x"
        Write-Info "Run .\bootstrap-env.ps1 -Force to recreate it with Python $PythonVersion.x"
        exit 1
    }
    else {
        Write-Success "Virtual environment already exists: $VenvDir"
        Write-Success "venv Python version is compatible: $VenvPythonVersion"
    }
}

if (-not (Test-Path $VenvDir)) {
    Write-Info "Creating new Python $PythonVersion virtual environment..."
    & $ProjectPython.Command @($ProjectPython.Arguments) -m venv $VenvDir

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

# Step 3: Validate Virtual Environment Python
Write-Header "Step 3: Validating Virtual Environment Python"

$ActivePython = Get-VenvPythonVersion
if ($null -eq $ActivePython) {
    Write-Error-Custom "Failed to read venv Python version"
    exit 1
}

if (-not (Test-RequiredPythonVersion $ActivePython)) {
    Write-Error-Custom "venv uses Python $ActivePython, but this project requires Python $PythonVersion.x"
    exit 1
}

Write-Success "Virtual environment Python is compatible: $ActivePython"
Write-Info "Using Python executable: $PythonExe"

# Step 4: Upgrade pip
Write-Header "Step 4: Upgrading pip, setuptools, and wheel"

Write-Info "Running: $PythonExe -m pip install --upgrade pip setuptools==78.0.1 wheel"
& $PythonExe -m pip install --upgrade pip setuptools==78.0.1 wheel --quiet

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
& $PythonExe -m pip install -r $RequirementsFile --quiet

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
& $PythonExe -c "import django; print('Django ' + str(django.VERSION))" 2>&1
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
    & $PythonExe -c "import $pkg" 2>&1
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
$PythonPrefix = & $PythonExe -c "import sys; print(sys.prefix)" 2>&1
Write-Info "Python prefix: $PythonPrefix"

if ($PythonPrefix -match "venv") {
    Write-Success "venv is correctly configured in PYTHONPATH"
}
else {
    Write-Warning-Custom "venv may not be in PYTHONPATH"
}

# Step 8: Node.js Tooling Validation
Write-Header "Step 8: Node.js Tooling Validation"

try {
    $NodeVersion = & node --version 2>&1
    Write-Success "Node.js detected: $NodeVersion"
}
catch {
    Write-Error-Custom "Node.js is not installed or not available in PATH"
    exit 1
}

try {
    $NpmVersion = & npm --version 2>&1
    Write-Success "npm detected: $NpmVersion"
}
catch {
    Write-Error-Custom "npm is not installed or not available in PATH"
    exit 1
}

# Step 9: Install Root Node Dependencies
Write-Header "Step 9: Installing Root Node Dependencies"

Write-Info "Installing root dependencies (husky/orchestration tooling)"
Push-Location $ProjectRoot
& npm install --quiet
$RootInstallExitCode = $LASTEXITCODE
Pop-Location

if ($RootInstallExitCode -eq 0) {
    Write-Success "Root Node dependencies installed successfully"
}
else {
    Write-Error-Custom "Failed to install root Node dependencies"
    exit 1
}

# Step 10: Install Frontend Dependencies
Write-Header "Step 10: Installing Frontend Dependencies"

Write-Info "Installing frontend dependencies with --ignore-scripts for deterministic setup"
Push-Location $FrontendDir
& npm install --ignore-scripts --quiet
$FrontendInstallExitCode = $LASTEXITCODE
Pop-Location

if ($FrontendInstallExitCode -eq 0) {
    Write-Success "Frontend dependencies installed successfully"
}
else {
    Write-Error-Custom "Failed to install frontend dependencies"
    exit 1
}

# Step 11: Frontend Environment File
Write-Header "Step 11: Frontend Environment Configuration"

if (-not (Test-Path $FrontendEnvFile) -and (Test-Path $FrontendEnvExample)) {
    Copy-Item $FrontendEnvExample $FrontendEnvFile
    Write-Success "Created frontend environment file: $FrontendEnvFile"
}
elseif (Test-Path $FrontendEnvFile) {
    Write-Success "Frontend environment file already exists: $FrontendEnvFile"
}
else {
    Write-Warning-Custom "Frontend .env.example not found; skipping .env.local creation"
}

# Summary and Next Steps
Write-Header "Bootstrap Complete - Environment Ready"

Write-Success "Summary:"
Write-Host "  * Project Root: $ProjectRoot"
Write-Host "  * venv Location: $VenvDir"
Write-Host "  * Frontend Directory: $FrontendDir"
Write-Host "  * Python Executable: $PythonExe"
Write-Host "  * Requirements File: $RequirementsFile"
Write-Host "  * Root Package File: $RootPackageFile"
Write-Host "  * Frontend Package File: $FrontendPackageFile"

Write-Info "Next Steps:"
Write-Host "  1. Start Django server: cd $BackendDir; .\venv\Scripts\python.exe manage.py runserver"
Write-Host "  2. Start frontend server: cd $FrontendDir; npm run dev"
Write-Host "  3. Run migrations: cd $BackendDir; .\venv\Scripts\python.exe manage.py migrate"
Write-Host "  4. VS Code auto-detects venv via .vscode/settings.json"
Write-Host ""

Write-Success "Enterprise-ready environment established"
