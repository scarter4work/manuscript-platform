@echo off
echo Deploying manuscript platform updates...
cd C:\manuscript-platform
git add .
git commit -m "Add beautiful PDF-style report generator"
git push
echo.
echo Deployed! Wait 30-60 seconds for Cloudflare to update.
echo Then test at: https://dashboard.scarter4workmanuscripthub.com
pause
