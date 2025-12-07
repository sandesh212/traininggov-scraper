#!/bin/bash

# Unit Scraper - Mac Double-Click Launcher
# This file is designed to be double-clicked on macOS

# Ensure we are in the correct directory (where the script is located)
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

# Check if Units.xlsx exists, if not create it from template or clean
if [ ! -f "Units.xlsx" ]; then
    echo "⚠️  Units.xlsx not found."
    echo "📄 Creating template Units.xlsx..."
    
    # Create valid blank Excel file using node script
    # We use a temporary node script to generate a valid xlsx
    cat > .create_template.js << 'EOL'
const fs = require('fs');
const path = require('path');
// Check if xlsx is installed in .config/node_modules, otherwise we can't create it easily
// Fallback: Create a warning text file if we can't create excel
try {
  const XLSX = require('./.config/node_modules/xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Unit Code'], ['BSBADM502'], ['TAEDEL401']]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, 'Units.xlsx');
  console.log("Template created.");
} catch (e) {
  console.error("Could not create Excel (dependencies missing?):", e.message);
}
EOL
    
    # Try to run with existing modules
    node .create_template.js
    rm .create_template.js
    
    if [ ! -f "Units.xlsx" ]; then
        # If node failed (e.g. modules not installed yet), lets try to just create it later or warn
        echo "❌ Could not auto-create Units.xlsx (dependencies likely missing)."
        echo "   Please run the scraper once to install dependencies, then try again,"
        echo "   OR manually create Units.xlsx in this folder."
    else
        echo "✅ Created template Units.xlsx"
    fi
    echo ""
fi

if [ -f "Units.xlsx" ]; then
    echo "✅ Found Units.xlsx"
else
    # Allow proceeding - maybe autoSync.ts can handle it or setup will install deps then we retry
    echo "⚠️  Proceeding without Units.xlsx (setup may create it)..."
fi
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
    
    # Retry creating template if it was missing 
    if [ ! -f "Units.xlsx" ]; then
        cat > .create_template.js << 'EOL'
const XLSX = require('./.config/node_modules/xlsx');
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['Unit Code'], ['BSBADM502'], ['TAEDEL401']]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, 'Units.xlsx');
EOL
        node .create_template.js > /dev/null 2>&1
        rm .create_template.js 2>/dev/null
        if [ -f "Units.xlsx" ]; then
            echo "✅ Created template Units.xlsx"
        fi
    fi
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
cd .config && npm start

echo ""
echo "════════════════════════════════════════════════════════════"
# Keep window open
read -p "Press any key to exit..."
