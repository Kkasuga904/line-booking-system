@echo off
REM Safe execution wrapper for batch files
REM Usage: safe-run.bat <batch-file-to-run>

if "%1"=="" (
    echo Usage: safe-run.bat ^<batch-file^>
    exit /b 1
)

echo ========================================
echo Safe Execution Mode
echo Running: %1
echo ========================================
echo.

REM Save current environment
setlocal EnableDelayedExpansion

REM Store critical paths
set "CLAUDE_PATH=C:\Users\user\.local\bin"
set "NPM_PATH=C:\Users\user\AppData\Roaming\npm"
set "NODE_PATH=C:\Program Files\nodejs"

REM Execute the target batch file
call "%1" %2 %3 %4 %5 %6 %7 %8 %9

REM Verify Claude is still accessible after execution
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Claude command lost after execution!
    echo [INFO] Attempting to restore...
    
    REM Try to restore PATH if needed
    set "PATH=%PATH%;%CLAUDE_PATH%"
    
    where claude >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to restore Claude
        echo [INFO] Run 'protect-claude.bat' to reinstall
    ) else (
        echo [OK] Claude restored successfully
    )
)

REM Restore environment
endlocal

echo.
echo ========================================
echo Safe execution completed
echo ========================================
exit /b 0