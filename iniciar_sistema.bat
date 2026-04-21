@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  Sistema Cobros Agua - Inicio Silencioso
REM  Mismo comportamiento que proyecto CELULAR:
REM  - Sin ventana de terminal visible
REM  - Navegador en modo App (ventana independiente, sin pestanas)
REM ============================================================

set "PROJECT_DIR=%~dp0"
cd /d "!PROJECT_DIR!"

REM --- Verificar e instalar dependencias si es necesario ---
if not exist "node_modules" goto INSTALL
if not exist "node_modules\.bin\vite.cmd" goto INSTALL
goto START_SERVER

:INSTALL
echo Instalando dependencias, por favor espere...
call npm install
if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias.
    echo Verifica tu conexion a internet e intenta de nuevo.
    pause
    exit /b 1
)

:START_SERVER
REM --- Lanzar npm run dev de forma SILENCIOSA (sin ventana visible) ---
set "VBS_FILE=%TEMP%\run_cobros_agua.vbs"

(
    echo Set objShell = CreateObject^("WScript.Shell"^)
    echo strCommand = "cmd.exe /c cd /d ""!PROJECT_DIR!"" && npm run dev"
    echo objShell.Run strCommand, 0, False
) > "!VBS_FILE!"

cscript.exe "!VBS_FILE!" >nul 2>&1
del "!VBS_FILE!" >nul 2>&1

REM --- Esperar a que Vite arranque ---
timeout /t 6 /nobreak >nul 2>&1

REM --- Abrir en modo App (ventana independiente, sin pestanas de navegador) ---
set "DATA_DIR=%USERPROFILE%\.cobros_agua_data"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM Intentar con Chrome
start "" "chrome.exe" --app="http://localhost:5173" --user-data-dir="%DATA_DIR%" --no-first-run --no-default-browser-check >nul 2>&1

REM Si Chrome falla, intentar con Edge
if errorlevel 1 (
    start "" "msedge.exe" --app="http://localhost:5173" --user-data-dir="%DATA_DIR%" --no-first-run --no-default-browser-check >nul 2>&1
)

exit /b
