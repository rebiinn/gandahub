@echo off
REM Start Laravel backend with PHP 8.5 (no PATH change needed)
set PHP85=C:\php-8.5.1-nts-Win32-vs17-x64\php.exe
if not exist "%PHP85%" (
    echo PHP 8.5 not found at %PHP85%
    pause
    exit /b 1
)
cd /d "%~dp0"
"%PHP85%" artisan serve
pause
