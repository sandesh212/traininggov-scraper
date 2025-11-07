#!/bin/bash

# Unit Scraper - Mac/Linux Launcher
# Double-click to run, or execute from terminal

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Training.gov.au Unit Scraper - Auto Setup & Run          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo "📥 Please install Node.js from https://nodejs.org/"
    echo "   Minimum version: v18 or higher"
    echo ""
    read -p "Press any key to exit..."
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo ""

# Check if Units.xlsx exists
if [ ! -f "Units.xlsx" ]; then
    echo "❌ ERROR: Units.xlsx not found in current directory!"
    echo "📄 Please place Units.xlsx in the same folder as this script."
    echo ""
    read -p "Press any key to exit..."
    exit 1
fi

echo "✅ Found Units.xlsx"
echo ""

# Auto-install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    echo "   This may take 1-2 minutes..."
    echo ""
    npm install --silent
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies!"
        echo "   Please check your internet connection and try again."
        read -p "Press any key to exit..."
        exit 1
    fi
    echo "✅ Dependencies installed successfully!"
    echo ""
fi

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
    echo "✅ Data directory created"
    echo ""
fi

# Run the scraper
echo "🚀 Starting scraper..."
echo ""
npx tsx src/autoSync.ts

echo ""
echo "════════════════════════════════════════════════════════════"
# Keep window open
read -p "Press any key to exit..."
