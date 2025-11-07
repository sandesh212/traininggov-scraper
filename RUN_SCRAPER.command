#!/bin/bash
cd "$(dirname "$0")"

osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'\" && ./START.sh"'
