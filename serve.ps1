# PowerShell Simple HTTP Server
# Run this script to serve files from the current directory

$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://localhost:8000/")
$http.Start()

Write-Host "Server running at http://localhost:8000/" -ForegroundColor Green
Write-Host "Open http://localhost:8000/test-simple.html in your browser" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red

try {
    while ($http.IsListening) {
        $context = $http.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/test-simple.html" }
        
        $localPath = "C:\manuscript-platform" + $path.Replace("/", "\")
        
        if (Test-Path $localPath) {
            $content = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = if ($path -match "\.html$") { "text/html" } `
                                   elseif ($path -match "\.js$") { "application/javascript" } `
                                   elseif ($path -match "\.css$") { "text/css" } `
                                   else { "application/octet-stream" }
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $http.Stop()
}