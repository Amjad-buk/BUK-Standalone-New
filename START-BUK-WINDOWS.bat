@echo off
cd /d "%~dp0"
if not exist .env (
  echo Missing .env file.
  echo Copy .env.example to .env, set DATABASE_URL and JWT_SECRET, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  npm install
  if errorlevel 1 goto :fail
)
if not exist dist\index.html (
  echo Building BUK frontend...
  npm run build
  if errorlevel 1 goto :fail
)
echo Starting BUK standalone...
npm start
goto :eof
:fail
echo BUK setup failed. Check the error shown above.
pause
