#!/bin/bash
# Steinwerk — Demo-Server starten
# Aufruf:  ./start.sh
# Beenden: Strg + C

cd "$(dirname "$0")" || exit 1

clear
echo ""
echo "  Demo läuft gleich. Der Browser öffnet sich automatisch."
echo ""

node server/server.js &
SERVER_PID=$!
sleep 1.2

open "http://127.0.0.1:8765/"
open "http://127.0.0.1:8765/admin.html"

trap 'kill $SERVER_PID 2>/dev/null' INT TERM
wait $SERVER_PID
