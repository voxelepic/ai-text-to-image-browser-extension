# AI Sheet Prompter

<p align="center">
  <img src="AI%20Sheet%20Prompter/icons/AI_Sheet_Prompter_Banner.gif" alt="AI Sheet Prompter Banner">
</p>

<p align="center">
  <strong>Bulk-submit prompts from Google Sheets to Gemini, ChatGPT, or Puter.js — automatically and resumably.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Chrome-Extension-green" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Vite-React-purple" alt="Vite + React">
  <img src="https://img.shields.io/badge/version-1.1.0-purple" alt="Version 1.1.0">
</p>

---

## ✨ Features

- **Multi-Target AI Support** — Route prompts to **Gemini**, **ChatGPT**, or directly to **Puter.js (Image Gen)**.
- **Resumable Queue Progress** — Memorable session history mapping `[Google Sheet URL + Tab Name]` to the current prompt index via `chrome.storage.local`. If Chrome crashes, restarts, or is closed, a **Resume** option appears to pick up exactly where the queue stopped.
- **Custom Output Folder Picker** — Write generated Puter.js images directly to a selected directory on your local machine using standard `window.showDirectoryPicker()` (cached in IndexedDB across browser restarts).
- **Flexible Column & Tab Configuration** — Choose any column (e.g. Column B, C) and Sheet tab name dynamically.
- **Robust CSV Parser** — Built-in RFC 4180 character scanner to parse public Sheets CSV feeds, correctly handling quoted newlines, commas, and escaped characters.
- **Puter Image Aspect Ratio Controls** — Choose target shapes (`1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9`) for Puter AI generation.
- **Premium Dark-Theme Interface** — Overhauled with a custom Shadcn/ui styling theme, interactive number spinners, auto-focus inputs, progress bar tracks, and a live preview gallery of generated images.
- **Event-Driven Service Worker** — Event-driven background queue scheduling via `chrome.alarms` prevents Chrome from suspending execution during processing delays.

---

## 📦 Installation

1. **Download / Clone** this repository.
2. Compile popup assets:

   ```bash
   cd "AI Sheet Prompter"
   pnpm install
   pnpm build
   ```

3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `AI Sheet Prompter` folder.

---

## 🚀 Usage

### 1. Prepare Your Google Sheet

- Create a Google Sheet containing your prompts in any column (e.g. Column B).
- Share the sheet as **"Anyone with the link can view"** (allows the CSV feed fetcher to read prompts).

### 2. Configure Target AI (for Gemini or ChatGPT)

- Open a browser tab with **[Gemini](https://gemini.google.com/app)** or **[ChatGPT](https://chatgpt.com)** and verify that you are signed in.
- *Note:* If you are using **Puter.js (Image Gen)**, you can run the generator directly within the extension popup. Simply log in or paste a Puter Auth Token from your Puter Dashboard.

### 3. Setup the Queue

1. Open the extension popup (or click **Open in Tab** in the header to run it in a persistent background tab).
2. Select your target AI model.
3. Paste the Google Sheet URL.
4. Input the target **Tab Name** (e.g., `Sheet1`), **Column** (e.g., `B`), and **Delay** between submissions (in seconds).
5. Click **Load Prompts** to load the queue.

### 4. Run

- If saved progress exists for this Sheet/Tab combination, you will see a badge showing `Found saved progress`. Click **Resume** to continue from your last position, or **Start Fresh** to begin from prompt 1.
- Otherwise, click **Start** to run the queue from the beginning.
- Click **Stop** at any time to pause execution.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
┌──────────────────────────────────────────────────────────┐
│                     Chrome Extension                     │
│                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐   │
│  │  Popup   │   │  Background  │   │ Content Scripts │   │
│  │   UI     │◄──│  Service     │──►│                 │   │
│  │ (Vite /  │   │  Worker      │   │  gemini.js      │   │
│  │  React)  │   │ (queue mgr)  │   │  chatgpt.js     │   │
│  └──────────┘   └──────────────┘   └─────────────────┘   │
│       │                │                    │            │
│       ▼                ▼                    ▼            │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐   │
│  │  Config  │   │    Google    │   │  Target AI Tab  │   │
│  │ Storage  │   │  Sheets CSV  │   │ (Active Browser │   │
│  │ (Local / │   └──────────────┘   │     Window)     │   │
│  │ Session) │                      └─────────────────┘   │
│  └──────────┘                                            │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
User clicks Resume / Start
       │
       ▼
Popup sends prompts & startIndex → Background Worker
                                      │
                             ┌────────▼─────────┐
                             │  Dequeue prompt  │◄──────────────┐
                             └────────┬─────────┘               │
                                      │                         │
                             Route to target tab                │
                                      │                         │
                       ┌──────────────┴──────────────┐          │
                       ▼                             ▼          │
                 gemini.js                     chatgpt.js       │
               types + submits              types + submits     │
                       │                             │          │
                       └──────────────┬──────────────┘          │
                                      │                         │
                             Wait for response to finish        │
                                      │                         │
                             Send "promptDone" to Worker        │
                                      │                         │
                             Save current index to local        │
                             storage history map                │
                                      │                         │
                             Wait configured delay              │
                                      │                         │
                             More prompts? ──── Yes ────────────┘
                                      │
                                     No
                                      │
                             Clear history state
                             Send "allDone" to Popup
```

---

## 📁 File Structure

```
AI Sheet Prompter/
├── manifest.json                 # Extension manifest (MV3)
├── package.json                  # Dependencies and scripts (Vite, React, Tailwind)
├── vite.config.js                # Vite build configuration
├── tailwind.config.js            # Tailwind styling tokens
├── popup.html                    # Entry HTML page
├── src/                          # React application source
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Main extension UI and state machine
│   ├── index.css                 # Global CSS and custom animations
│   ├── lib/
│   │   └── db.js                 # IndexedDB helpers for output directory caching
│   └── components/
│       └── ui/                   # Premium Shadcn/ui custom components
│           ├── button.jsx
│           ├── card.jsx
│           ├── field.jsx
│           ├── input.jsx
│           ├── label.jsx
│           ├── number-input.jsx
│           ├── progress.jsx
│           └── select.jsx
├── background/
│   └── service-worker.js         # Event-driven MV3 background service worker
├── content/
│   ├── gemini.js                 # DOM injector for gemini.google.com
│   └── chatgpt.js                # DOM injector for chatgpt.com
├── utils/
│   ├── sheets.js                 # Character scanner for RFC 4180 CSVs
│   └── storage.js                # chrome.storage serialization utilities
└── icons/
    └── icon.png                  # Extension logo asset
```

---

## ⚙️ Technical Details

### Storage & Session Management

| API / Store | Purpose | Size / Limit |
|-------------|---------|--------------|
| `chrome.storage.session` | Active queue runtime state (prompts, current index, delay) — survives popup close, cleared on browser restart. | Limitless (Session memory) |
| `chrome.storage.local` | Queue progress history map indexed by Sheet URL + Tab. Survives browser crashes, restarts, and closures. | Negligible (~100 bytes per sheet) |
| `chrome.storage.sync` | User configurations (target AI, sheet inputs, delay) — syncs across devices. | 100 KB max |
| `IndexedDB` | Stores browser folder handles from `window.showDirectoryPicker()` to write files locally across sessions. | Standard sandbox quota |

---

## ⚠️ Limitations

- **Public sheets only** — The sheet link must be shared publicly (read-only CSV endpoint).
- **DOM dependency** — Content scripts rely on DOM selectors that may break if Gemini/ChatGPT update their interface structure.
- **Login required** — You must already be logged into Gemini/ChatGPT on your active browser profile.

---

## 📄 License

This project is provided as-is for personal use.
