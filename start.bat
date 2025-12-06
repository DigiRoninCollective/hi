@echo off
REM PumpFun Twitter Launcher - Startup Script for Windows
REM Starts backend server and frontend web UI simultaneously

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════╗
echo ║   PumpFun Twitter Launcher - Startup Script    ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ✗ Node.js is not installed. Please install Node.js 18+
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION%

REM Check if npm is installed
where npm >nul 2>nul
if errorlevel 1 (
    echo ✗ npm is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✓ npm %NPM_VERSION%
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ✗ .env file not found in root directory
    echo   Please create .env file with required configuration
    exit /b 1
)

echo ✓ Root .env file found

REM Check if web\.env exists
if not exist "web\.env" (
    echo ✗ web\.env file not found
    echo   Please create web\.env file with required configuration
    exit /b 1
)

echo ✓ Web .env file found
echo.

REM Install dependencies if needed
if not exist "node_modules\" (
    echo Installing root dependencies...
    call npm install
    echo ✓ Root dependencies installed
    echo.
)

if not exist "web\node_modules\" (
    echo Installing web dependencies...
    cd web
    call npm install
    cd ..
    echo ✓ Web dependencies installed
    echo.
)

REM Build TypeScript if needed
if not exist "dist\" (
    echo Building TypeScript...
    call npm run build
    echo ✓ TypeScript build complete
    echo.
)

REM Start servers
echo Installing concurrently if needed...
npm list concurrently >nul 2>nul
if errorlevel 1 (
    echo Installing concurrently...
    call npm install --save-dev concurrently
    echo.
)

echo.
echo ╔════════════════════════════════════════════════╗
echo ║          Starting Backend ^& Frontend           ║
echo ╚════════════════════════════════════════════════╝
echo.
echo Backend  : http://localhost:3000
echo Frontend : http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.

REM Start both backend and frontend
call npx concurrently ^
  --names "BACKEND,FRONTEND" ^
  --prefix "[{name}]" ^
  --prefix-colors "blue,cyan" ^
  --handle-input ^
  --restart-tries 2 ^
  --restart-delay 1000 ^
  "npm run dev" ^
  "npm run dev:web"

pause
