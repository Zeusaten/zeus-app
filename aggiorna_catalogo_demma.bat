@echo off
cd /d "%~dp0"

echo.
echo [1/3] Aggiorno catalogo Demma...
python demma_sync.py --max-pages 2 --sleep 0.1
if errorlevel 1 (
  echo.
  echo ERRORE durante aggiornamento catalogo Demma.
  pause
  exit /b 1
)

echo.
echo [2/3] Build frontend...
npm run build
if errorlevel 1 (
  echo.
  echo ERRORE durante build frontend.
  pause
  exit /b 1
)

echo.
echo [3/3] Fatto.
echo Ora puoi fare:
echo git add demma_sync.py aggiorna_catalogo_demma.bat public\catalog\demma\catalog.json
echo git commit -m "Fix Demma catalog scraper"
echo git push origin main
echo.
pause
