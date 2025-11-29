# 🔑 Setting Up Real AI Analysis

## Current Status
⚠️ **The app is currently running in MOCK MODE**

This means:
- Questions are extracted correctly ✅
- But AI analysis is simulated (all questions map to MARN008) ❌

## How to Enable Real AI

### Step 1: Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### Step 2: Add the API Key

Create a `.env.local` file in the `web` directory:

```bash
cd web
echo "OPENAI_API_KEY=sk-your-actual-key-here" > .env.local
```

**Important**: Replace `sk-your-actual-key-here` with your actual API key!

### Step 3: Restart the Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Test with Real AI

Upload your files and run analysis. You should now see:
- ✅ Real AI reasoning
- ✅ Accurate unit mapping based on question content
- ✅ Specific performance criteria identified
- ✅ Relevant knowledge evidence matched

## What the Real AI Does

When enabled, the AI will:

1. **Read Each Question**: Understand what skill/knowledge is being tested
2. **Analyze Units**: Compare against ALL provided units from your Excel file
3. **Find Best Match**: Select the unit that best covers the question
4. **Map Criteria**: Identify specific performance criteria (e.g., "1.1", "2.3")
5. **Map Knowledge**: Link to knowledge evidence requirements
6. **Provide Reasoning**: Explain why this unit was chosen
7. **Identify Gaps**: Note any missing coverage

## Example Real AI Output

**Mock Mode** (current):
```json
{
  "mappedUnit": "MARN008",
  "reasoning": "MOCK ANALYSIS: Question matched to MARN008 based on keywords.",
  "confidence": 85
}
```

**Real AI Mode** (with API key):
```json
{
  "mappedUnit": "MARN008",
  "reasoning": "This question tests knowledge of Working Load Limits (WLL), which is covered under MARN008 Element 1 'Handle ropes and mooring lines'. The question specifically relates to performance criteria 1.1 'Ropes are handled safely' and knowledge evidence requirement for understanding safe working loads.",
  "mappedCriteria": ["1.1", "1.3"],
  "mappedKnowledge": ["Safe working loads", "Rope handling procedures"],
  "confidence": 92
}
```

## Cost Estimate

OpenAI API costs (as of 2024):
- **GPT-4**: ~$0.03 per 1K tokens
- **For 50 questions**: Approximately $0.50 - $1.50 per analysis

## Troubleshooting

### "Invalid API Key" Error
- Check that your key starts with `sk-`
- Ensure no extra spaces in `.env.local`
- Verify the key is active at https://platform.openai.com/api-keys

### "Rate Limit" Error
- You may need to add credits to your OpenAI account
- Or wait a few minutes between large batches

### Still Seeing Mock Results
- Make sure you restarted the server after adding the key
- Check the terminal for any error messages
- Verify `.env.local` is in the `web` directory (not the root)

## Security Note

⚠️ **Never commit `.env.local` to git!**

The `.gitignore` file should already exclude it, but double-check:
```bash
cat .gitignore | grep .env.local
```

---

**Once you add your API key and restart, the app will provide real, intelligent analysis of your assessment questions!** 🚀
