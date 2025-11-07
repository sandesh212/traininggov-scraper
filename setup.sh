#!/bin/bash

# Automatic Setup Script for Mac/Linux
# Ensures all dependencies and folders are created

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Training.gov.au Scraper - Initial Setup                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "📥 Please install Node.js from https://nodejs.org/ (v18 or higher)"
    echo ""
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo "✅ npm detected: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies!"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

echo "✅ Data directory created"
echo ""

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x START.sh
chmod +x setup.sh

echo "✅ Scripts are now executable"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Place your Units.xlsx file in this directory"
echo "  2. Double-click START.sh or run: ./START.sh"
echo "════════════════════════════════════════════════════════════"
echo ""
