# Browser Extension: Google Sheets → Gemini Sequential Prompter

## Overview

A Chrome extension that reads a list of prompts from a Google Sheet and submits them one-by-one to Gemini (gemini.google.com/app), waiting for each response before sending the next.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Chrome Extension                  │
│                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Popup   │   │  Background  │   │   Content   │  │
│  │   UI     │◄──│   Worker     │──►│   Script    │  │
│  │          │   │  (queue mgr) │   │ (Gemini DOM)│  │
│  └──────────┘   └──────────────┘   └─────────────┘  │
│        │               │                            │
│        ▼               ▼                            │
│  ┌──────────┐   ┌──────────────┐                    │
│  │  Config  │   │  Google      │                    │
│  │ Storage  │   │  Sheets API  │                    │
│  └──────────┘   └──────────────┘                    │
└─────────────────────────────────────────────────────┘
```

---

## File Structure

```
gemini-sheet-prompter/
├── manifest.json               # Extension manifest (MV3)
├── popup/
│   ├── popup.html              # Extension popup UI
│   ├── popup.css               # Popup styles
│   └── popup.js                # Popup logic (config, start/stop)
├── background/
│   └── service-worker.js       # Queue manager, Sheets API calls
├── content/
│   └── gemini.js               # Injected into gemini.google.com
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    ├── sheets.js               # Google Sheets fetch helpers
    └── storage.js              # chrome.storage wrappers
```

---

## Component Details

### 1. Manifest (MV3)

- `permissions`: `storage`, `activeTab`, `tabs`, `alarms`
- `host_permissions`: `https://gemini.google.com/*`, `https://chatgpt.com/*`, `https://docs.google.com/*`
- `content_scripts`: auto-inject content scripts on `gemini.google.com` and `chatgpt.com`
- `background`: `service_worker: "background/service-worker.js"`

---

### 2. Popup UI

Fields the user configures:
- **Sheet ID** — the Google Sheets document ID (from the URL)
- **Sheet Tab Name** — which tab/sheet to read from (default: `Sheet1`)
- **Column** — which column holds the prompts (e.g., `A`)
- **Start Row** — first row to read (default: `2`, skipping header)
- **API Key** — Google Sheets API key (read-only, no OAuth needed)
- **Delay between prompts** — seconds to wait after each response (default: `3`)

Buttons:
- **Load Prompts** — fetches and previews the prompt list
- **Start** — begins sequential submission
- **Stop** — halts the queue mid-run
- **Progress display** — `Prompt 3 / 12 complete`

---

### 3. Google Sheets Integration (`sheets.js`)

Use the **Sheets API v4** with an API key (read-only, no OAuth required).

```
GET https://sheets.googleapis.com/v4/spreadsheets/{sheetId}/values/{range}?key={apiKey}
```

- Parse the returned `values` array into a flat list of prompt strings
- Skip blank rows
- Expose `fetchPrompts(sheetId, tab, column, startRow, apiKey)` → `string[]`

**Alternative (no API key):** If the sheet is publicly shared, use the CSV export URL:
```
https://docs.google.com/spreadsheets/d/{sheetId}/gviz/tq?tqx=out:csv&sheet={tab}
```
Parse with a simple CSV parser. No API key needed — good default for MVP.

---

### 4. Background Service Worker (`service-worker.js`)

Owns the prompt queue and orchestrates execution.

**State:**
```js
{
  prompts: string[],       // full list loaded from sheet
  currentIndex: number,    // next prompt to send
  running: boolean,        // whether queue is active
  delay: number,           // ms to wait between prompts
}
```

**Flow:**
1. Popup sends `{ action: "start", prompts, delay }` message
2. Worker sets `running = true`, stores state in `chrome.storage.session`
3. Worker sends `{ action: "sendPrompt", text }` to the Gemini content script
4. Worker listens for `{ action: "promptDone" }` reply from content script
5. Advances index, schedules a `chrome.alarms` timer for the `delay` interval to safely handle background service worker suspension, and sends the next prompt when the alarm fires
6. Sends `{ action: "allDone" }` to popup when queue is exhausted

**Why session storage:** survives popup close, cleared on browser restart.

---

### 5. Gemini Content Script (`gemini.js`)

Injected into `gemini.google.com/app`. Handles actual DOM interaction.

**Sending a prompt:**
1. Find the input textarea: `document.querySelector('[data-placeholder]')` or `div[contenteditable="true"]`
2. Set its content via `innerText` + dispatch `input` event
3. Find and click the submit button: `button[aria-label*="Send"]`

**Detecting response completion:**
- Watch for the "Stop generating" button to appear then disappear
- Or use a `MutationObserver` on the response container
- Or poll for the submit button to re-enable (disabled while generating)
- Wait an extra 1–2s buffer after completion for safety

**Message handling:**
```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sendPrompt") {
    sendPrompt(msg.text).then(() => {
      chrome.runtime.sendMessage({ action: "promptDone" });
    });
  }
});
```

---

## Data Flow (End-to-End)

```
User clicks Start
       │
       ▼
Popup sends prompts → Background Worker
                             │
                    ┌────────▼─────────┐
                    │  Dequeue prompt  │◄──────────────┐
                    └────────┬─────────┘               │
                             │                         │
                    Send to Content Script             │
                             │                         │
                    Content script types prompt        │
                    & submits to Gemini                │
                             │                         │
                    Wait for response to finish        │
                             │                         │
                    Send "promptDone" to Worker        │
                             │                         │
                    Wait configured delay              │
                             │                         │
                    More prompts? ──────── Yes ────────┘
                             │
                            No
                             │
                    Send "allDone" to Popup
                    Show completion notice
```

---

## Implementation Phases

### Phase 1 — MVP (Core Loop)
- [x] Scaffold extension with manifest, popup, service worker, content script
- [x] Implement CSV export method for public Google Sheets (no API key)
- [x] Implement Gemini DOM interaction (type + submit + wait)
- [x] Wire up background queue and message passing
- [x] Basic popup UI: sheet URL input, start/stop, progress counter

### Phase 2 — Polish
- [ ] Add Google Sheets API v4 support with API key field
- [ ] Configurable delay, column, start row
- [ ] Prompt preview list in popup before starting
- [ ] Error handling: Gemini rate limit detection, retry logic
- [ ] Save config to `chrome.storage.sync` (persists across installs)

### Phase 3 — Optional Enhancements
- [ ] Export responses: capture each Gemini response and save to another Sheet column
- [ ] Support multiple sheets / batch files
- [ ] Notification when all prompts complete (even if popup is closed)
- [ ] Dark mode popup UI

---

## Key Technical Challenges

| Challenge | Approach |
|---|---|
| Gemini DOM changes (no stable selectors) | Use multiple fallback selectors + attribute-based queries |
| Detecting when response is done | MutationObserver on response container + button state |
| Gemini rate limits / "too many requests" | Detect error messages in DOM, pause and retry with backoff |
| Content script ↔ worker messaging | `chrome.runtime.sendMessage` / `onMessage` with async replies |
| Popup closes mid-run | Store full queue state in `chrome.storage.session` |
| Sheet is private (needs auth) | Phase 2: OAuth 2.0 via `chrome.identity.getAuthToken` |

---

## Getting a Google Sheets API Key (for Phase 2)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Sheets API**
3. Credentials → Create API Key → restrict to Sheets API
4. Paste into extension popup — key is stored locally, never sent anywhere except Google's API

---

## Notes

- The extension requires the user to be **logged into Gemini** in Chrome already
- Gemini's UI is a React SPA — input must be triggered with proper DOM events, not just `value` assignment
- Keep delays ≥ 3s between prompts to avoid triggering Gemini's rate limiting
- MV3 service workers are ephemeral — all mutable state must be persisted to `chrome.storage.session`
