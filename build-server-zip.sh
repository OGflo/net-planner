#!/bin/bash
# Builds dist/NetPlanner-Server.zip (server + website) ready to unpack and install.
set -e
cd "$(dirname "$0")"
OUT=dist/NetPlanner-Server
rm -rf "$OUT" dist/NetPlanner-Server.zip
mkdir -p "$OUT/web"
cp server/netplanner_server.py server/config.json server/README.txt server/*.command server/*.bat server/*.sh server/Dockerfile server/docker-compose.yml server/netplanner.service "$OUT/"
cp web/*.html web/*.js "$OUT/web/"
chmod +x "$OUT"/*.command "$OUT"/*.sh "$OUT"/netplanner_server.py
(cd dist && zip -qr -X NetPlanner-Server.zip NetPlanner-Server)
echo "Built dist/NetPlanner-Server.zip"
