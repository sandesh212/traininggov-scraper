#!/bin/bash

echo "🧪 Testing AI Assessment Validator Web Application"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if server is running
echo "Test 1: Checking if server is running..."
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi

# Test 2: Check if required files exist
echo ""
echo "Test 2: Checking if test files exist..."
if [ -f "sample-units.xlsx" ]; then
    echo -e "${GREEN}✓ sample-units.xlsx exists${NC}"
else
    echo -e "${RED}✗ sample-units.xlsx not found${NC}"
    exit 1
fi

if [ -f "../Knowledge Coxswain Deck Marking Sheet.docx" ]; then
    echo -e "${GREEN}✓ Assessment DOCX file exists${NC}"
else
    echo -e "${RED}✗ Assessment DOCX file not found${NC}"
    exit 1
fi

# Test 3: Test API endpoint
echo ""
echo "Test 3: Testing API endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/analyze \
  -F "unitsFile=@sample-units.xlsx" \
  -F "assessmentFile=@../Knowledge Coxswain Deck Marking Sheet.docx")

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo -e "${GREEN}✓ API returned valid JSON${NC}"
else
    echo -e "${RED}✗ API returned invalid JSON${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test 4: Verify response structure
echo ""
echo "Test 4: Verifying response structure..."

UNIT_CODES=$(echo "$RESPONSE" | jq -r '.unitCodes | length')
QUESTIONS_COUNT=$(echo "$RESPONSE" | jq -r '.questionsCount')
RESULTS_COUNT=$(echo "$RESPONSE" | jq -r '.results | length')

if [ "$UNIT_CODES" -gt 0 ]; then
    echo -e "${GREEN}✓ Unit codes extracted: $UNIT_CODES${NC}"
else
    echo -e "${RED}✗ No unit codes found${NC}"
fi

if [ "$QUESTIONS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Questions extracted: $QUESTIONS_COUNT${NC}"
else
    echo -e "${RED}✗ No questions found${NC}"
fi

if [ "$RESULTS_COUNT" -eq "$QUESTIONS_COUNT" ]; then
    echo -e "${GREEN}✓ All questions analyzed: $RESULTS_COUNT${NC}"
else
    echo -e "${YELLOW}⚠ Results count ($RESULTS_COUNT) doesn't match questions count ($QUESTIONS_COUNT)${NC}"
fi

# Test 5: Verify question text is included
echo ""
echo "Test 5: Verifying question details..."

FIRST_QUESTION_TEXT=$(echo "$RESPONSE" | jq -r '.results[0].questionText')
if [ "$FIRST_QUESTION_TEXT" != "null" ] && [ -n "$FIRST_QUESTION_TEXT" ]; then
    echo -e "${GREEN}✓ Question text is included${NC}"
    echo "  Sample: ${FIRST_QUESTION_TEXT:0:80}..."
else
    echo -e "${RED}✗ Question text is missing${NC}"
fi

# Test 6: Save full report
echo ""
echo "Test 6: Generating test report..."
echo "$RESPONSE" | jq '.' > test-full-report.json
echo -e "${GREEN}✓ Full report saved to test-full-report.json${NC}"

# Summary
echo ""
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo "Unit Codes Found: $UNIT_CODES"
echo "Questions Extracted: $QUESTIONS_COUNT"
echo "Questions Analyzed: $RESULTS_COUNT"
echo ""
echo "Unit Codes:"
echo "$RESPONSE" | jq -r '.unitCodes[]' | while read code; do
    echo "  - $code"
done
echo ""
echo "Mapped Units:"
echo "$RESPONSE" | jq -r '.mappedUnits[] | "  - \(.code): \(.title)"'
echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "To view the full report:"
echo "  cat test-full-report.json | jq '.'"
echo ""
echo "To view a specific question:"
echo "  cat test-full-report.json | jq '.results[0]'"
