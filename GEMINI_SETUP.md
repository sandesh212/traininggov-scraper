# Switch to Gemini (Lightweight & Effective)

The system detected that Ollama was causing instability (crashing). We have switched the configuration to use **Google Gemini 1.5 Flash**, which is:
1.  **Lightweight**: Runs in the cloud, so it won't crash your computer.
2.  **Effective**: High reasoning capabilities for parsing and validation.
3.  **Fast**: One of the fastest models available.

## ACTION REQUIRED

You need to add your Gemini API Key to `web/.env.local`.

1.  Get a free key here: [Google AI Studio](https://aistudio.google.com/app/apikey)
2.  Open `web/.env.local`
3.  Replace `[INSERT_YOUR_GEMINI_API_KEY_HERE]` with your actual key.

## Live Fetching Updates

- **Text Files Support**: You can now upload a `.txt` file containing a list of Unit Codes (one per line). The system will **live fetch** these from training.gov.au instead of expecting full JSON data.
- **Excel Support**: Uploading `.xlsx` files with codes will also trigger live scraping.
