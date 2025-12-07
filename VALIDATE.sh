#!/bin/bash

# =============================================================================
# FULLY AUTOMATED ASSESSMENT VALIDATOR
# =============================================================================
#
# WHAT IT DOES (AUTOMATICALLY):
# 1. Finds your unit list Excel file
# 2. Extracts unit codes
# 3. Scrapes unit details from training.gov.au (if needed)
# 4. Finds all assessment files (Word/Excel)
# 5. Detects clustering (multi-unit assessments)
# 6. Uses AI to validate questions against performance criteria
# 7. Generates comprehensive compliance report
#
# JUST RUN IT - That's all!
# =============================================================================

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║          🤖 FULLY AUTOMATED ASSESSMENT VALIDATOR                       ║"
echo "║          Uses FREE local AI (Ollama) - No API key needed!             ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ ERROR: Ollama is not installed"
    echo ""
    echo "To install Ollama:"
    echo "  1. Visit: https://ollama.com"
    echo "  2. Download and install for macOS"
    echo "  3. Run: ollama pull llama3.2"
    echo "  4. Run: ollama pull nomic-embed-text"
    echo "  5. Then run this script again"
    echo ""
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "❌ ERROR: Ollama is not running"
    echo ""
    echo "To start Ollama:"
    echo "  Run: ollama serve"
    echo ""
    echo "Or it may start automatically. Try again in a few seconds."
    echo ""
    exit 1
fi

echo "✅ Ollama is ready!"
echo ""

# Navigate to config directory
cd "$(dirname "$0")/.config" || exit 1

# Run the automated validator
npm run auto

# Capture exit code
EXIT_CODE=$?

# Return to original directory
cd ..

exit $EXIT_CODE
