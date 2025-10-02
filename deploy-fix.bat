@echo off
echo Deploying annotated manuscript fix...
cd /d C:\manuscript-platform
git add annotated-manuscript-generator.js
git add frontend\index.html
git commit -m "Fix annotated manuscript HTML rendering - spans now display correctly"
git push
echo.
echo Deployed! Wait 30-60 seconds for Cloudflare to update.
echo Then test by uploading a new manuscript at: https://dashboard.scarter4workmanuscripthub.com
pause
