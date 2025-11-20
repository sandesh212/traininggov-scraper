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
echo "║          Just drop your files and run - I do the rest!                ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ ERROR: OPENAI_API_KEY not set"
    echo ""
    echo "Please set your OpenAI API key:"
    echo "  1. Get key from: https://platform.openai.com/api-keys"
    echo "  2. Run: export OPENAI_API_KEY=\"sk-proj-your-key-here\""
    echo "  3. Or add to ~/.zshrc for permanent use"
    echo ""
    exit 1
fi

# Navigate to config directory
cd "$(dirname "$0")/.config" || exit 1

# Run the automated validator
npm run auto

# Capture exit code
EXIT_CODE=$?

# Return to original directory
cd ..

exit $EXIT_CODE
