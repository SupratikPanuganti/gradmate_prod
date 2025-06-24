# Read OpenAI API key from .env.local
$envContent = Get-Content ..\..\.env.local

function Get-EnvValue([string]$key) {
    $line = ($envContent | Where-Object { $_ -match "^$key=" } | Select-Object -First 1)
    if ($null -eq $line) { return "" }
    return ($line -replace "^$key=", "").Trim().Trim('"')
}

# Read keys
$openaiKey = Get-EnvValue 'OPENAI_API_KEY'
$supabaseUrl = Get-EnvValue 'SUPABASE_URL'
$supabaseServiceRoleKey = Get-EnvValue 'SUPABASE_SERVICE_ROLE_KEY'
$geminiKey = Get-EnvValue 'GEMINI_API_KEY'

if (-not $openaiKey) {
    Write-Error "OPENAI_API_KEY not found in .env.local file"
    exit 1
}

if (-not $supabaseUrl -or -not $supabaseServiceRoleKey) {
    Write-Error "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local file"
    exit 1
}

# Gemini key is optional; warn if absent but continue
if (-not $geminiKey) {
    Write-Host "GEMINI_API_KEY not found in .env.local; Gemini integration will be disabled." -ForegroundColor Yellow
}

# Create a temporary directory for the deployment package
New-Item -ItemType Directory -Force -Path .\deploy
Copy-Item lambda_function.py .\deploy\

# Ensure custom source code is included so Lambda can import the new modules
Copy-Item ..\..\src .\deploy\src -Recurse

# Install dependencies built for Amazon Linux (manylinux2014). This avoids the
# `pydantic_core` import error that occurs when Windows wheels are bundled.
pip install -r requirements.txt -t .\deploy\ --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: --upgrade

# Create a ZIP file of the Lambda function and dependencies
if (Test-Path function.zip) { Remove-Item function.zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory("deploy","function.zip")

# Deploy to AWS Lambda
aws lambda update-function-code `
    --function-name gradmate-ai-service `
    --zip-file fileb://function.zip `
    --region us-east-2

# Update environment variables
# (includes optional GEMINI_API_KEY)
aws lambda update-function-configuration `
    --function-name gradmate-ai-service `
    --environment "Variables={OPENAI_API_KEY=$openaiKey,SUPABASE_URL=$supabaseUrl,SUPABASE_SERVICE_ROLE_KEY=$supabaseServiceRoleKey,GEMINI_API_KEY=$geminiKey}" `
    --region us-east-2

# Clean up
Remove-Item -Recurse -Force .\deploy
Remove-Item function.zip 