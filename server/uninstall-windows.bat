@echo off
REM Removes Net Planner auto-start. Your data in %LOCALAPPDATA%\NetPlanner\data is kept.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NetPlanner Server.bat" 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like *netplanner_server.py* } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Net Planner stopped and removed from startup. Files remain in %LOCALAPPDATA%\NetPlanner
pause
