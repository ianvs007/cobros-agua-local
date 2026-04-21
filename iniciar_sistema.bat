@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  SIGUA Local - Inicio Silencioso
REM  - Sin ventana de terminal visible
REM  - Inicia servidor Express + Vite automaticamente
REM  - Navegador en modo App (ventana independiente, sin pestanas)
REM ============================================================

set "PROJECT_DIR=%~dp0"
cd /d "!PROJECT_DIR!"

REM --- Verificar e instalar dependencias si es necesario ---
if not exist "node_modules" goto INSTALL
if not exist "node_modules\.bin\vite.cmd" goto INSTALL
goto CHECK_DB

:INSTALL
echo Instalando dependencias, por favor espere...
call npm install
if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias.
    echo Verifica tu conexion a internet e intenta de nuevo.
    pause
    exit /b 1
)

:CHECK_DB
REM --- Inicializar base de datos si no existe ---
if not exist "server\cobros_agua.db" (
    echo Inicializando base de datos local...
    call node server/init-db.js
    if errorlevel 1 (
        echo [ERROR] No se pudo inicializar la base de datos.
        pause
        exit /b 1
    )
)

:START_SERVER
REM --- Lanzar servidor Express de forma SILENCIOSA ---
set "VBS_SERVER=%TEMP%\run_cobros_server.vbs"

(
    echo Set objShell = CreateObject^("WScript.Shell"^)
    echo strCommand = "cmd.exe /c cd /d ""!PROJECT_DIR!"" && node server/server.js"
    echo objShell.Run strCommand, 0, False
) > "!VBS_SERVER!"

cscript.exe "!VBS_SERVER!" >nul 2>&1
del "!VBS_SERVER!" >nul 2>&1

REM --- Esperar a que el servidor Express arranque ---
timeout /t 2 /nobreak >nul 2>&1

REM --- Lanzar Vite de forma SILENCIOSA ---
set "VBS_VITE=%TEMP%\run_cobros_vite.vbs"

(
    echo Set objShell = CreateObject^("WScript.Shell"^)
    echo strCommand = "cmd.exe /c cd /d ""!PROJECT_DIR!"" && npm run dev"
    echo objShell.Run strCommand, 0, False
) > "!VBS_VITE!"

cscript.exe "!VBS_VITE!" >nul 2>&1
del "!VBS_VITE!" >nul 2>&1

REM --- Esperar a que Vite arranque ---
timeout /t 5 /nobreak >nul 2>&1

REM --- Abrir en modo App (ventana independiente, sin pestanas de navegador) ---
set "DATA_DIR=%USERPROFILE%\.cobros_agua_local_data"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM Intentar con Chrome
start "" "chrome.exe" --app="http://localhost:5173" --user-data-dir="%DATA_DIR%" --no-first-run --no-default-browser-check >nul 2>&1

REM Si Chrome falla, intentar con Edge
if errorlevel 1 (
    start "" "msedge.exe" --app="http://localhost:5173" --user-data-dir="%DATA_DIR%" --no-first-run --no-default-browser-check >nul 2>&1
)

exit /b
