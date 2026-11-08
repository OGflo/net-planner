@echo off
REM Double-click to run Net Planner without installing it. Close this window to stop it.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 netplanner_server.py & goto :eof)
where python >nul 2>nul && (python netplanner_server.py & goto :eof)
echo Python 3 is needed: https://www.python.org/downloads/  (tick "Add python.exe to PATH")
pause
