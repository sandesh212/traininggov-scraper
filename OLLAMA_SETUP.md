# How to Set Up Ollama for Local Analysis

You can now use Ollama (running locally on your PC) to power the Analysis features for free, instead of using OpenAI.

## 1. Install & Run Ollama
If you haven't already:
1. Download Ollama from [ollama.com](https://ollama.com).
2. Install it.
3. Run it.

## 2. Pull the Models
Open a terminal and pull the models you want to use. We recommend `llama3` for general logic:

```bash
ollama pull llama3
```

## 3. Configure the App
Create or edit the `.env.local` file in the `web` directory (`web/.env.local`).

Add these lines:

```bash
# Point to your local Ollama instance
AI_BASE_URL=http://127.0.0.1:11434/v1

# Specify the model you pulled
AI_MODEL=llama3

# The API key can be anything for Ollama, but must be present
OPENAI_API_KEY=ollama
```

## 4. Restart the App
After changing `.env.local`, you must restart the server:

1. Stop the running server (Ctrl+C).
2. Run `npm start` (or `npm run build && npm start` if you made code changes).

## 5. Verify
When you run an Analysis, check the server logs. You should see:
`🤖 AIService initialized in LOCAL mode (Ollama at http://127.0.0.1:11434/v1) with model: llama3`
