@echo off
chcp 65001 >nul
title 기계설비 공정분리 자동화 툴
cd /d "%~dp0"

rem ── Node.js 설치 확인 ─────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js 가 설치되어 있지 않습니다.
  echo      https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo.
  start "" https://nodejs.org/ko
  pause
  exit /b 1
)

rem ── .env 없으면 예시 파일로 생성 ──────────────────
if not exist ".env" (
  if exist ".env.example" copy ".env.example" ".env" >nul
)

rem ── 포트 읽기 (.env 의 PORT, 없으면 3000) ─────────
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b /c:"PORT=" .env 2^>nul') do set PORT=%%a

rem ── 처음 실행 시 패키지 설치 ──────────────────────
if not exist "node_modules\" (
  echo.
  echo  처음 실행이라 필요한 패키지를 설치합니다. 1~3분 정도 걸립니다...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [!] 패키지 설치에 실패했습니다. 인터넷 연결을 확인하세요.
    pause
    exit /b 1
  )
)

rem ── 이미 실행 중이면 브라우저만 열기 ───────────────
curl -s -o nul http://localhost:%PORT%/api/health 2>nul
if not errorlevel 1 (
  echo  이미 실행 중입니다. 브라우저를 엽니다.
  start "" http://localhost:%PORT%
  exit /b 0
)

rem ── 서버 준비되면 브라우저 자동 열기 (백그라운드) ──
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/health -TimeoutSec 1 | Out-Null; Start-Process 'http://localhost:%PORT%'; break}catch{Start-Sleep 1}}"

echo.
echo  ================================================
echo   기계설비 공정분리 자동화 툴 실행 중
echo   주소: http://localhost:%PORT%
echo   이 창을 닫으면 프로그램이 종료됩니다.
echo  ================================================
echo.
call npm run dev
pause
