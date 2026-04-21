@echo off
title SIGUA - Sistema Local de Cobros de Agua
color 0A

echo ====================================
echo   SIGUA - VERSION LOCAL
echo   Sistema de Cobros de Agua
echo ====================================
echo.

cd /d "%~dp0"

:: Verificar si node esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarga Node.js desde: https://nodejs.org
    pause
    exit /b 1
)

:: Verificar si node_modules existe
if not exist "node_modules" (
    echo [INSTALANDO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

:: Inicializar base de datos si no existe
if not exist "server\cobros_agua.db" (
    echo [BD] Inicializando base de datos local...
    call node server/init-db.js
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo al inicializar la base de datos.
        pause
        exit /b 1
    )
)

echo.
echo [SERVIDOR] Iniciando servidor API local (puerto 3001)...
start /b node server/server.js

:: Esperar a que el servidor inicie
timeout /t 2 /nobreak >nul

echo [FRONTEND] Iniciando interfaz grafica...
echo.
echo ====================================
echo   Sistema listo. Abriendo navegador...
echo   NO CIERRES ESTA VENTANA
echo ====================================
echo.

:: Iniciar Vite y abrir el navegador
start http://localhost:5173
call npx vite
