# 🚀 Ollama Setup Guide

## What is Ollama?

Ollama is a **FREE, local AI** that runs entirely on your computer. Unlike OpenAI:
- ✅ **100% Free** - No API costs
- ✅ **Private** - Data never leaves your computer
- ✅ **Offline** - Works without internet
- ✅ **Fast** - Runs locally on your machine

---

## 📥 Installation (macOS)

### Step 1: Download Ollama

```bash
# Visit the website
open https://ollama.com

# Or install via terminal
curl -fsSL https://ollama.com/install.sh | sh
```

**Download size:** ~500 MB

### Step 2: Verify Installation

```bash
# Check if Ollama is installed
ollama --version

# Should show something like: ollama version 0.x.x
```

### Step 3: Download Required Models

```bash
# Download the chat model (llama3.2 - 2GB)
ollama pull llama3.2

# Download the embedding model (nomic-embed-text - 274MB)
ollama pull nomic-embed-text
```

**Total download:** ~2.3 GB (one-time download)

### Step 4: Verify Models

```bash
# List installed models
ollama list

# Should show:
# nomic-embed-text:latest    274 MB
# llama3.2:latest            2.0 GB
```

---

## 🎯 Quick Start

Once installed, the validator will use Ollama automatically:

```bash
# Just run the validator
./VALIDATE.sh

# Ollama starts automatically in the background
# No API key needed!
```

---

## 🔧 Manual Ollama Commands

### Start Ollama Server
```bash
ollama serve
```
(Usually starts automatically, but you can run this if needed)

### Test Chat Model
```bash
ollama run llama3.2 "Explain what a performance criterion is"
```

### Test Embedding Model
```bash
ollama run nomic-embed-text "test embedding"
```

### Stop Ollama
```bash
# Ollama runs as a service, but if needed:
killall ollama
```

---

## 💻 System Requirements

### Minimum:
- **RAM:** 8GB
- **Disk:** 10GB free space
- **CPU:** Any modern Mac (M1/M2/Intel)

### Recommended:
- **RAM:** 16GB+ (for faster processing)
- **Disk:** 20GB+ free space
- **CPU:** M1/M2/M3 Mac (faster than Intel)

---

## 📊 Performance Comparison

### Processing 150 Questions:

| AI System | Time | Cost | Internet | Privacy |
|-----------|------|------|----------|---------|
| **Ollama** | 15-30 min | FREE | Not needed | 100% Private |
| **OpenAI** | 3-5 min | $0.08 | Required | Cloud-based |

---

## 🐛 Troubleshooting

### "ollama: command not found"

```bash
# Reinstall Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Or download from website
open https://ollama.com
```

### "Ollama is not running"

```bash
# Start manually
ollama serve

# Or check if it's already running
curl http://localhost:11434/api/tags
```

### "Failed to pull model"

```bash
# Check internet connection
# Try again:
ollama pull llama3.2
ollama pull nomic-embed-text

# If still failing, delete and re-download
ollama rm llama3.2
ollama pull llama3.2
```

### "Out of memory"

Your computer doesn't have enough RAM. Options:
1. Close other applications
2. Use a smaller model: `ollama pull llama3.2:1b`
3. Upgrade RAM to 16GB+
4. Use OpenAI instead (see OPENAI_SETUP.md)

### Models are slow

This is normal for local AI. Options to speed up:
1. Upgrade to M1/M2/M3 Mac (much faster)
2. Close other applications
3. Use OpenAI instead (10x faster, but costs money)

---

## 🔄 Updating Ollama

```bash
# Update Ollama itself
curl -fsSL https://ollama.com/install.sh | sh

# Update models
ollama pull llama3.2
ollama pull nomic-embed-text
```

---

## 📁 Ollama Files Location

```
~/.ollama/
├── models/           # Downloaded models (2-3 GB)
└── logs/             # Ollama logs
```

To free up space:
```bash
# Remove unused models
ollama rm model-name

# Remove all models
rm -rf ~/.ollama/models
```

---

## ✅ Verification Checklist

Before running the validator, ensure:

- [ ] Ollama is installed: `ollama --version`
- [ ] Llama3.2 is downloaded: `ollama list | grep llama3.2`
- [ ] Nomic-embed-text is downloaded: `ollama list | grep nomic`
- [ ] Ollama is running: `curl http://localhost:11434/api/tags`

If all checked ✅, you're ready to run:
```bash
./VALIDATE.sh
```

---

## 💡 Why Ollama?

### For Development/Testing:
- **FREE** - Perfect for trying the system
- **Fast enough** - 15-30 minutes is acceptable
- **Private** - Great for sensitive assessment data

### For Production:
- Consider OpenAI if you need:
  - Faster processing (10x speed)
  - Higher accuracy (5-10% better)
  - No local hardware requirements

---

## 🔄 Switching to OpenAI Later

Want to switch to OpenAI for production?

Just set the API key and the system will prefer OpenAI if available:
```bash
export OPENAI_API_KEY="sk-proj-your-key-here"
./VALIDATE.sh
```

The system will automatically:
1. Check for OpenAI API key
2. If found, use OpenAI (faster)
3. If not, use Ollama (free)

Best of both worlds! 🎉

---

## 📞 Need Help?

### Ollama Documentation:
- Website: https://ollama.com
- GitHub: https://github.com/ollama/ollama
- Discord: https://discord.gg/ollama

### Common Issues:
1. **Slow performance?** Normal for local AI
2. **Out of memory?** Need 16GB+ RAM
3. **Models not found?** Re-run `ollama pull`
4. **Port already in use?** Another Ollama instance is running

---

## 🎉 Summary

**Installation (one time):**
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Download models
ollama pull llama3.2
ollama pull nomic-embed-text

# 3. Run validator
./VALIDATE.sh
```

**That's it! Free, private, local AI validation!** 🚀

---

**Ready to validate assessments with FREE AI?**

Run: `./VALIDATE.sh` ✅
