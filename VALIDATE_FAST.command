#!/bin/bash

# FAST VALIDATOR - Uses Custom AI (2-3 seconds!)
# Double-click this file to validate your assessments

cd "$(dirname "$0")"

echo "=========================================="
echo "  ⚡ FAST Assessment Validator"
echo "  Using Custom AI Engine"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo "  Visit: https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Node.js found"
echo ""
echo "Starting fast validation..."
echo "=========================================="
echo ""

# Run the fast validator
cd .config
npx tsx fast-test.ts

echo ""
echo "=========================================="
echo "Validation complete!"
echo ""
read -p "Press Enter to close..."
