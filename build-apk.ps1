$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Users\ELCOT\.jdks\jbr-21.0.11'
$env:ANDROID_HOME = 'C:\Users\ELCOT\AppData\Local\Android\Sdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "Using JAVA_HOME: $env:JAVA_HOME"
Write-Host "Using ANDROID_HOME: $env:ANDROID_HOME"

Write-Host "Stopping any running Gradle daemons..."
Set-Location -Path "android"
.\gradlew.bat --stop

Write-Host "Building Android APK (assembleDebug)..."
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Gradle assembleDebug completed!"
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-latest.apk" -Force
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-v1.0.apk" -Force
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-v1.1.apk" -Force
    Write-Host "COPIED TO: AuraMusic-latest.apk, AuraMusic-v1.0.apk, AuraMusic-v1.1.apk"
} else {
    Write-Host "BUILD FAILED with exit code $LASTEXITCODE"
}
