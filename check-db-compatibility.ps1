# Database Compatibility Check Script
# This script searches for old database field patterns that need to be migrated

Write-Host "Checking for old database field patterns..." -ForegroundColor Cyan

$oldPatterns = @(
    "patients\.active_problems",
    "patients\.current_medications",
    "appointments\.subjective_notes",
    "appointments\.objective_notes",
    "appointments\.assessment_notes",
    "appointments\.plan_notes",
    "appointments\.active_medication_orders",
    "appointments\.past_medication_orders",
    "appointments\.chief_complaint",
    "appointments\.ros_general",
    "appointment_documents"
)

$filesToCheck = @(
    "src\app\doctor\patients\page.tsx",
    "src\app\doctor\appointments\page.tsx",
    "src\app\doctor\dashboard\page.tsx",
    "src\app\doctor\communication\page.tsx",
    "src\app\doctor\ai-assistant\page.tsx",
    "src\app\api\appointments\[id]\route.ts",
    "src\app\api\prescriptions\erx-compose\route.ts",
    "src\app\api\cdss\generate\route.ts"
)

$issues = @()

foreach ($file in $filesToCheck) {
    $filePath = Join-Path $PSScriptRoot $file
    if (Test-Path $filePath) {
        Write-Host "`nChecking: $file" -ForegroundColor Yellow
        $content = Get-Content $filePath -Raw
        
        foreach ($pattern in $oldPatterns) {
            if ($content -match $pattern) {
                $lineNumber = ($content -split "`n" | Select-String -Pattern $pattern | Select-Object -First 1).LineNumber
                $issues += "⚠️  $file : Line ~$lineNumber : Found '$pattern'"
                Write-Host "  ⚠️  Found: $pattern" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠️  File not found: $file" -ForegroundColor Gray
    }
}

Write-Host "`n" -NoNewline
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
    Write-Host "✅ No old database patterns found!" -ForegroundColor Green
} else {
    Write-Host "Found $($issues.Count) potential issues:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Yellow
    }
    Write-Host "`nPlease review these files and migrate to normalized tables." -ForegroundColor Yellow
}

