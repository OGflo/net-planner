#!/bin/bash
# Double-click to run Net Planner without installing it. Close this window to stop it.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed. Install it with:  xcode-select --install"; read -r -p "Press Enter to close"; exit 1
fi
exec python3 netplanner_server.py
