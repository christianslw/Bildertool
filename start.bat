@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "EXE=%SCRIPT_DIR%dist\bildertool\bildertool.exe"

:: Use the bundled exe if it exists (end-user mode – no Python install needed)
if exist "%EXE%" (
    start "" "%EXE%"
    goto :eof
)

:: Dev fallback: run via venv Python (requires Python + venv installed)
echo [Bildertool] Kein Build gefunden – starte im Entwicklungsmodus...
set "VENV_ACTIVATE=%SCRIPT_DIR%.venv\Scripts\activate.bat"

if not exist "%VENV_ACTIVATE%" (
    echo [Bildertool] Kein .venv gefunden. Bitte zuerst: python -m venv .venv ^& pip install -r backend/image_categorizer/requirements.txt
    pause
    goto :eof
)

start "" cmd /c "call ""%VENV_ACTIVATE%"" && cd /d ""%SCRIPT_DIR%backend"" && python -m image_categorizer.main"

:eof
endlocal
