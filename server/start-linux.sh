#!/bin/sh
# Run Net Planner on Linux:  sh start-linux.sh
cd "$(dirname "$0")" && exec python3 netplanner_server.py "$@"
