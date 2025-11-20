#!/bin/bash
# Smart Universal Validator - Mac Version
# Auto-detects units and maps to PC/PE/KE
cd "$(dirname "$0")"
echo "🧠 SMART Universal Validator"
echo "Auto-detects Everything!"
echo ""
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    read -p "Press Enter to exit..."
    exit 1
fi
echo "✅ Node.js found"
if [ -n "$1" ]; then
    cd .config && npx tsx smart-validate.ts "$1"
else
    cd .config && npx tsx smart-validate.ts
fi
echo ""
read -p "Press Enter to close..."
