param(
  [string]$BaseUrl = 'https://pios-coral.vercel.app',
  [string]$HealthSecret = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) {
  Write-Host "`n=== $message ==="
}

function Fail($message) {
  Write-Error $message
  exit 1
}

function Assert($condition, $message) {
  if (-not $condition) {
    Fail $message
  }
}

function Get-BodyText($url) {
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing
  return $response.Content
}

Write-Step "Public health endpoint"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
Assert (-not ($health.PSObject.Properties.Name -contains 'checks')) "Public /api/health is still exposing detailed checks."
Assert (($health.PSObject.Properties.Name -contains 'ok')) "Public /api/health did not return the expected summary payload."
Write-Host "PASS public health returns summary only"

if ($HealthSecret) {
  Write-Step "Detailed health endpoint with secret"
  $detailedHealth = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -Headers @{ 'x-health-secret' = $HealthSecret }
  Assert (($detailedHealth.PSObject.Properties.Name -contains 'checks')) "Detailed /api/health response did not return checks with secret header."
  Write-Host "PASS secret-gated health details are available"
}

Write-Step "Landing page"
$landingBody = Get-BodyText "$BaseUrl/"
Assert ($landingBody -match 'PIOS') "Landing page does not include expected PIOS content."
Write-Host "PASS landing page content signal"

Write-Step "Signup page"
$signupBody = Get-BodyText "$BaseUrl/auth/signup?plan=executive"
Assert ($signupBody -match 'Magic link|magic link') "Signup page does not show the expected magic-link flow."
Write-Host "PASS signup page magic-link signal"

Write-Step "Dashboard protection"
try {
  $dashboard = Invoke-WebRequest -Uri "$BaseUrl/platform/dashboard" -MaximumRedirection 0 -UseBasicParsing
  $dashboardStatus = [int]$dashboard.StatusCode
} catch {
  if (-not $_.Exception.Response) { throw }
  $dashboardStatus = [int]$_.Exception.Response.StatusCode
}
Assert (($dashboardStatus -eq 302) -or ($dashboardStatus -eq 307) -or ($dashboardStatus -eq 308)) "Unauthenticated dashboard access is not redirecting as expected."
Write-Host "PASS dashboard is protected"

Write-Step "Cron brief protection"
try {
  $cron = Invoke-WebRequest -Uri "$BaseUrl/api/cron/brief" -MaximumRedirection 0 -UseBasicParsing
  $cronStatus = [int]$cron.StatusCode
} catch {
  if (-not $_.Exception.Response) { throw }
  $cronStatus = [int]$_.Exception.Response.StatusCode
}
Assert ($cronStatus -eq 401) "Cron brief endpoint is not returning 401 without auth."
Write-Host "PASS cron brief requires auth"

Write-Step "Automated smoke suite"
node scripts/uat-smoke-test.js $BaseUrl
if ($LASTEXITCODE -ne 0) {
  Fail "Automated smoke suite failed."
}
Write-Host "PASS automated smoke suite"

Write-Step "Result"
Write-Host "Post-deploy verification completed successfully for $BaseUrl"