param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8765,
    [switch]$Reload
)

$env:BILDERTOOL_AI_HOST = $HostName
$env:BILDERTOOL_AI_PORT = "$Port"

$python = Join-Path $PSScriptRoot "..\..\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "Python environment not found at $python"
}

Push-Location (Join-Path $PSScriptRoot "..")
try {
    if ($Reload) {
        & $python -m uvicorn image_categorizer.main:app --host $HostName --port $Port --reload
    } else {
        & $python -m image_categorizer.main
    }
} finally {
    Pop-Location
}
