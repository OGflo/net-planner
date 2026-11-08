@echo off
REM Installs Net Planner into %LOCALAPPDATA%\NetPlanner and starts it automatically at sign-in.
setlocal
set "SRC=%~dp0"
set "DEST=%LOCALAPPDATA%\NetPlanner"
set "PY="
where pyw >nul 2>nul && set "PY=pyw -3"
if not defined PY where pythonw >nul 2>nul && set "PY=pythonw"
if not defined PY (echo Python 3 is needed: https://www.python.org/downloads/  ^(tick "Add python.exe to PATH"^) & pause & exit /b 1)
echo Installing Net Planner to %DEST% ...
robocopy "%SRC%." "%DEST%" /E /XD data /XF config.json *.log >nul
if not exist "%DEST%\config.json" copy "%SRC%config.json" "%DEST%\config.json" >nul
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\NetPlanner Server.bat" echo @echo off
>> "%STARTUP%\NetPlanner Server.bat" echo cd /d "%DEST%"
>> "%STARTUP%\NetPlanner Server.bat" echo start "" %PY% "%DEST%\netplanner_server.py" --no-browser
cd /d "%DEST%"
start "" %PY% "%DEST%\netplanner_server.py"
echo.
echo Net Planner is installed and running. It starts automatically when you sign in.
echo If Windows Firewall asks, allow Private networks so your phone can reach it.
pause
