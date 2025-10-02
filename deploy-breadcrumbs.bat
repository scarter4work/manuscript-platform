@echo off
echo Deploying breadcrumbs and fixes...
cd /d C:\manuscript-platform
git add annotated-manuscript-generator.js
git add report-generator.js
git add frontend\index.html
git add worker.js
git commit -m "Add breadcrumb navigation to all pages and fix HTML rendering in annotated manuscripts"
git push
echo.
echo Deployed! Wait 30-60 seconds for Cloudflare to update.
echo.
echo Changes deployed:
echo - Added breadcrumbs to Summary Report page
echo - Added breadcrumbs to Dashboard when viewing reports
echo - Fixed annotated manuscript HTML span rendering
echo - Removed Author ID field from dashboard
echo.
echo Test at: https://dashboard.scarter4workmanuscripthub.com
pause
