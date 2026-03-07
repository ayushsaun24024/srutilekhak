# Śrutilekhak (श्रुतिलेखक)

> 🎙️ Local, privacy-first, real-time transcription — right in your browser.

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/ayushsaun24024/srutilekhak/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Browser](https://img.shields.io/badge/browser-Chrome%20%7C%20Chromium-yellow.svg)]()
[![Languages](https://img.shields.io/badge/languages-21-orange.svg)]()

---

## 🧠 What Is Śrutilekhak?

**Śrutilekhak** (Sanskrit: श्रुतिलेखक — *"one who writes what is heard"*) is a browser extension that transcribes audio from any tab — lectures, meetings, videos, podcasts — in real-time, completely on your device.

No servers. No uploads. No surveillance. Just words.

---

## ✨ Features

### 🌍 Multilingual Transcription
- **21 languages** supported — and growing
- Powered by **OpenAI Whisper** via Transformers.js (fully local)
- RTL layout support for Arabic
- Language-optimized audio chunking for better accuracy

| Language Family | Languages | Chunk Size |
|---|---|---|
| Latin / Phonetic | Spanish, French, German, Italian, Dutch, Polish, Turkish, Swedish, Norwegian, Danish, Finnish, Indonesian | 3s |
| Tonal / Complex | Hindi, Arabic, Russian, Portuguese, Thai | 5s |
| Character-based | Chinese, Japanese, Korean | 6s |

### 🎛️ Caption Customization
- Draggable overlay with auto-saved position
- Font size (12–32px), family (5 options), and color picker
- Background color + opacity slider (0–100%)
- 6 position presets (top/bottom × left/center/right)
- Clear captions without stopping transcription
- Reset position to preset after dragging

### ⚡ Performance & UX
- Cached content script injection — less overhead per chunk
- Combined storage reads — faster initialization
- Optimistic stop button — instant UI response
- Status indicators: Ready → Initializing → Transcribing
- Settings persist across browser sessions

### 🔒 Privacy First
- **100% on-device** — no audio ever leaves your machine
- No accounts, no API keys, no telemetry
- Works fully offline after initial model load

---

## 🚀 Installation

### For Users
1. Head to the [Releases](https://github.com/ayushsaun24024/srutilekhak/releases) page
2. Download the latest extension package
3. Open `chrome://extensions/` in your browser
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the extension folder
6. Pin the extension and you're good to go 🎉

### For Developers
```bash
# Clone the repo
git clone https://github.com/ayushsaun24024/srutilekhak.git
cd srutilekhak

# Install dependencies
npm install

# Build for development (with watch mode)
npm run build:dev

# Build for production
npm run build

# Load in Chrome
# chrome://extensions → Enable Developer Mode → Load unpacked → select dist/
```

---

## 🏗️ Project Structure

```
srutilekhak/
├── src/
│   ├── background/       # Service worker — tab capture & state management
│   ├── content/          # Content script — caption overlay & UI
│   ├── offscreen/        # Offscreen document — Whisper model & audio processing
│   ├── popup/            # Extension popup — controls & settings
│   └── utils/            # Shared helpers
├── public/               # Static assets & manifest
├── dist/                 # Built extension (generated)
└── package.json
```

---

## 🔧 How It Works

```
Browser Tab Audio
      ↓
 Tab Capture API
      ↓
 Offscreen Document
      ↓
 Whisper (Transformers.js) — fully local
      ↓
 Transcript Text
      ↓
 Caption Overlay on Page
```

1. **Capture** — Chrome's `tabCapture` API streams tab audio
2. **Chunk** — Audio is split into language-optimized chunks (3–6s)
3. **Transcribe** — Whisper model processes each chunk locally
4. **Display** — Text is rendered as a draggable, customizable overlay

---

## 🌐 Supported Languages

| # | Language | Code | Script |
|---|---|---|---|
| 1 | English | `en` | Latin |
| 2 | Spanish | `es` | Latin |
| 3 | French | `fr` | Latin |
| 4 | German | `de` | Latin |
| 5 | Hindi | `hi` | Devanagari |
| 6 | Chinese | `zh` | Hanzi |
| 7 | Arabic | `ar` | Arabic (RTL) |
| 8 | Japanese | `ja` | Kanji/Kana |
| 9 | Korean | `ko` | Hangul |
| 10 | Portuguese | `pt` | Latin |
| 11 | Russian | `ru` | Cyrillic |
| 12 | Italian | `it` | Latin |
| 13 | Dutch | `nl` | Latin |
| 14 | Polish | `pl` | Latin |
| 15 | Turkish | `tr` | Latin |
| 16 | Swedish | `sv` | Latin |
| 17 | Norwegian | `no` | Latin |
| 18 | Danish | `da` | Latin |
| 19 | Finnish | `fi` | Latin |
| 20 | Indonesian | `id` | Latin |
| 21 | Thai | `th` | Thai |

---

## 🤝 Contributing

Contributions are very welcome! Whether it's a bug fix, a new language, or a feature idea — jump in.

### Getting Started
1. Fork the repo
2. Create your branch: `git checkout -b feature/your-feature-name`
3. Make your changes and test thoroughly
4. Commit: `git commit -m "feat: describe your change"`
5. Push: `git push origin feature/your-feature-name`
6. Open a PR against `develop` — not `main`

### Branch Strategy
```
main        ← stable production releases only
staging     ← pre-release testing
develop     ← active development (base branch for all PRs)
```

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use For |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `chore:` | Maintenance / tooling |
| `docs:` | Documentation updates |
| `refactor:` | Code restructure, no behavior change |

### What We'd Love Help With
- 🌏 Adding more languages (especially Indian languages!)
- 🎨 UI/UX improvements to the caption overlay
- ⚡ Transcription accuracy and latency improvements
- 🧪 Testing across different video platforms
- 📖 Documentation improvements

---

## ⚠️ Known Limitations

- Manual language selection required (no auto-detection yet)
- No transcript history or export
- No translation (transcription only)
- No cloud sync
- Chrome / Chromium only (Firefox support planned)

---

## 📄 License

MIT © [Ayush Saun](https://github.com/ayushsaun24024)

---

## 🙏 Acknowledgements

- [OpenAI Whisper](https://github.com/openai/whisper) — the transcription model powering everything
- [Xenova Transformers.js](https://github.com/xenova/transformers.js) — running Whisper in the browser
- The open-source community for making local AI possible

---

<p align="center">Made with ❤️ for privacy, accessibility, and the love of language.</p>
