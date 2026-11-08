#!/bin/bash
# Stops Net Planner and removes the auto-start. Your plan data in ~/NetPlanner/data is kept.
LABEL="local.netplanner.server"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Net Planner stopped and removed from login items."
echo "Your files are still in ~/NetPlanner (delete that folder to remove everything)."
read -r -p "Press Enter to close"
