# Quick deploy script
Set-Location "C:\manuscript-platform"
git add .
git commit -m "Improve JSON parsing robustness in all agents"
git push
Write-Host "Deployed! Wait 30-60 seconds for Cloudflare to update..." -ForegroundColor Green
