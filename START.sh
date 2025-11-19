#!/bin/bash

# Unit Scraper - Mac/Linux Launcher
# Double-click to run, or execute from terminal

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Training.gov.au Unit Scraper - Auto Setup & Run          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check internet connectivity
echo "🌐 Checking internet connection..."
if ! ping -c 1 -W 2 training.gov.au &> /dev/null && ! ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
    echo "❌ ERROR: No internet connection detected!"
    echo "   Please check your network connection and try again."
    echo ""
    read -p "Press any key to exit..."
    exit 1
fi
echo "✅ Internet connection OK"
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
if [ ! -d ".config/node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    echo "   This may take 1-2 minutes..."
    echo ""
    cd .config && npm install --silent && cd ..
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
cd .config && npx tsx src/autoSync.ts && cd ..

echo ""
echo "════════════════════════════════════════════════════════════"
# Keep window open
read -p "Press any key to exit..."
