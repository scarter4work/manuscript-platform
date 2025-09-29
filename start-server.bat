@echo off
echo Starting local web server on http://localhost:8000
echo Press Ctrl+C to stop
echo.
cd /d C:\manuscript-platform
python -m http.server 8000
pause