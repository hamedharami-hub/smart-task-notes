@echo off
echo ===================================================
echo     ARSHNAZ - Building Android APK with Widget
echo ===================================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo 1. Building Web Assets...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Web build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo 2. Syncing Capacitor Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b %ERRORLEVEL%
)

echo 3. Compiling Android APK with Gradle...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gradle build failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo ===================================================
echo [SUCCESS] APK built successfully!
echo Location: android\app\build\outputs\apk\debug\app-debug.apk
echo ===================================================
pause
