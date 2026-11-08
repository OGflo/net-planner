#!/bin/bash
# Installs Net Planner into ~/NetPlanner and starts it automatically at login.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/NetPlanner"
LABEL="local.netplanner.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then echo "Python 3 is needed. Install it with:  xcode-select --install"; read -r -p "Press Enter to close"; exit 1; fi

echo "Installing Net Planner to $DEST ..."
mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
# copy program files; never overwrite your plan data or settings
rsync -a --exclude data --exclude config.json --exclude '*.log' "$SRC/" "$DEST/"
[ -f "$DEST/config.json" ] || cp "$SRC/config.json" "$DEST/config.json"
PORT="$("$PY" -c "import json;print(json.load(open('$DEST/config.json')).get('port',8770))" 2>/dev/null || echo 8770)"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$DEST/netplanner_server.py</string><string>--no-browser</string></array>
  <key>WorkingDirectory</key><string>$DEST</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DEST/server.log</string>
  <key>StandardErrorPath</key><string>$DEST/server.log</string>
</dict></plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 2
echo
echo "Net Planner is installed and running. It starts automatically when you log in."
grep -E "On this computer|From your phone" "$DEST/server.log" | tail -2 || true
echo "Your plan data lives in $DEST/data"
open "http://localhost:$PORT"
read -r -p "Press Enter to close"
