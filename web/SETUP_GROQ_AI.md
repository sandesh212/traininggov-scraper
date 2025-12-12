
# 🚀 Supercharge Analysis with Groq (Free & Fast)

Your local AI analysis might be slow depending on your hardware. To make the "Analyze" feature lightning fast (and free!), we recommend using **Groq**.

Groq offers a free beta API that is compatible with this project and runs Llama 3 models at extremely high speeds.

## 1. Get a Free API Key
1. Go to [console.groq.com](https://console.groq.com/keys).
2. Sign up / Log in.
3. Click **"Create API Key"**.
4. Copy the key (starts with `gsk_...`).

## 2. Update Your Environment
Open your `.env.local` file in the `web` folder and update (or add) these lines:

```bash
# web/.env.local

# The Base URL for Groq
AI_BASE_URL=https://api.groq.com/openai/v1

# Your Groq API Key
OPENAI_API_KEY=gsk_YOUR_KEY_HERE

# The Model to use (Llama 3 70B is versatile and accurate)
AI_MODEL=llama3-70b-8192
```

## 3. Restart the App
Stop your current server (Ctrl+C) and run:
```bash
npm run dev
```

## Why Groq?
- **Speed**: Analyses that take minutes locally will take seconds on Groq.
- **Cost**: Currently free during their beta.
- **Quality**: Llama 3 70B is very capable for mapping units and parsing text.
