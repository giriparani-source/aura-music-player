$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Users\ELCOT\jdk21_extracted\jdk-21.0.4+7'
$env:ANDROID_HOME = 'C:\Users\ELCOT\AppData\Local\Android\Sdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "Stopping any running Gradle daemons..."
Set-Location -Path "android"
.\gradlew.bat --stop

Write-Host "Building Android APK (assembleDebug)..."
.\gradlew.bat :app:packageDebug --rerun-tasks
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Gradle assembleDebug completed!"
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-v1.2.2.apk" -Force
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-latest.apk" -Force
    Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "..\AuraMusic-v1.2.1.apk" -Force
    Write-Host "COPIED TO: AuraMusic-v1.2.2.apk, AuraMusic-latest.apk, and AuraMusic-v1.2.1.apk"
} else {
    Write-Host "BUILD FAILED with exit code $LASTEXITCODE"
}
