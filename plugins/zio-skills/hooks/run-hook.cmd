@echo off
setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set HOOK_NAME=%1

REM Handle different hook types
if "%HOOK_NAME%"=="session-start" (
    for /f "delims=" %%A in ('type "%SCRIPT_DIR%\..\skills\zio-http-scaffold\SKILL.md"') do (
        echo %%A
    )
)
