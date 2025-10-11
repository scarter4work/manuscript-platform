@echo off
echo ========================================
echo Deploying Asset Generation Module
echo ========================================
echo.

echo Step 1: Deploying Worker (backend)...
call wrangler deploy
if errorlevel 1 (
    echo ERROR: Worker deployment failed!
    pause
    exit /b 1
)
echo.
echo ✓ Worker deployed successfully!
echo.

echo Step 2: Deploying Frontend...
call wrangler pages deploy frontend
if errorlevel 1 (
    echo ERROR: Frontend deployment failed!
    pause
    exit /b 1
)
echo.
echo ✓ Frontend deployed successfully!
echo.

echo ========================================
echo Deployment Complete! 🚀
echo ========================================
echo.
echo Your asset generation module is now live!
echo.
echo Next steps:
echo 1. Visit your dashboard URL
echo 2. Upload a manuscript and complete analysis
echo 3. Click "Generate Marketing Assets"
echo 4. Review and customize the AI-generated assets
echo.
pause
