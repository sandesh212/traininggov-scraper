#!/bin/bash

# Double-clickable macOS launcher for Assessment Validator
# This file will open a Terminal window and run the validator

cd "$(dirname "$0")"

echo "=========================================="
echo "  RTO Assessment Validator (Ollama)"
echo "=========================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ ERROR: Ollama is not installed!"
    echo ""
    echo "Please install Ollama first:"
    echo "  1. Visit: https://ollama.com/download"
    echo "  2. Download and install Ollama for macOS"
    echo "  3. Run this launcher again"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "⚠️  Ollama is not running. Starting Ollama..."
    ollama serve &
    sleep 3
fi

# Check for required models
echo "Checking Ollama models..."
if ! ollama list | grep -q "llama3.2"; then
    echo "📥 Downloading llama3.2 model (this may take a few minutes)..."
    ollama pull llama3.2
fi

if ! ollama list | grep -q "nomic-embed-text"; then
    echo "📥 Downloading nomic-embed-text model..."
    ollama pull nomic-embed-text
fi

echo ""
echo "✅ All requirements met!"
echo ""
echo "Starting validation..."
echo "=========================================="
echo ""

# Run the validator
cd .config
npm run auto

echo ""
echo "=========================================="
echo "Validation complete!"
echo ""
read -p "Press Enter to close..."
