/**
 * Content script injected into chatgpt.com.
 * Handles DOM interaction: typing prompts, clicking send, waiting for response.
 *
 * Uses the same message protocol as gemini.js so the background service worker
 * doesn't need to know which AI is active.
 */

/* ------------------------------------------------------------------ */
/*  Message listener                                                   */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "sendPrompt") {
    // Acknowledge receipt synchronously to keep the channel clean
    sendResponse({ ok: true });

    sendPrompt(msg.text)
      .then(() => {
        chrome.runtime.sendMessage({ action: "promptDone" }, () => {
          if (chrome.runtime.lastError) {
            // Ignore channel close errors (e.g., popup closed)
          }
        });
      })
      .catch(err => {
        chrome.runtime.sendMessage({ action: "promptError", error: err.message }, () => {
          if (chrome.runtime.lastError) {
            // Ignore channel close errors
          }
        });
      });
  }
});

/* ------------------------------------------------------------------ */
/*  Core: send a prompt and wait for the response                     */
/* ------------------------------------------------------------------ */

async function sendPrompt(text) {
  // 1. Find the input field
  const inputField = findInputField();
  if (!inputField) {
    throw new Error("Could not find ChatGPT input field. The UI may have changed.");
  }

  // 2. Focus and set text
  inputField.focus();

  // ChatGPT uses a contenteditable div (ProseMirror) or a textarea
  if (inputField.tagName === "TEXTAREA") {
    // Set value via native input setter to bypass React's synthetic event system
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    ).set;
    nativeInputValueSetter.call(inputField, text);
    inputField.dispatchEvent(new Event("input", { bubbles: true }));
    inputField.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // contenteditable div (ProseMirror editor)
    // Clear existing content first
    inputField.textContent = "";

    // Create a paragraph with the text (ProseMirror format)
    const p = document.createElement("p");
    p.textContent = text;
    inputField.appendChild(p);

    // Dispatch events so the framework picks up the change
    inputField.dispatchEvent(new Event("input", { bubbles: true }));
    inputField.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    }));
  }

  // 3. Wait for the framework to process
  await delay(500);

  // 4. Find and click the send button
  const sendButton = findSendButton();
  if (!sendButton) {
    throw new Error("Could not find the Send button. The UI may have changed.");
  }

  // Click the send button exactly once to prevent double-submitting / duplicate prompt spam
  sendButton.click();

  // 5. Record submission time
  const submittedAt = Date.now();

  // 6. Wait for response to finish
  await waitForResponseDone(submittedAt);
}

/* ------------------------------------------------------------------ */
/*  Find the input field                                               */
/* ------------------------------------------------------------------ */

function findInputField() {
  const selectors = [
    // Primary: ChatGPT's ProseMirror contenteditable
    '#prompt-textarea',
    // Contenteditable div inside the composer
    'div[contenteditable="true"][id="prompt-textarea"]',
    // Textarea fallback
    'textarea#prompt-textarea',
    // Generic contenteditable in the composer area
    'form div[contenteditable="true"]',
    'div[contenteditable="true"].ProseMirror',
    // Last resort
    'textarea[placeholder*="Message"]',
    'textarea[data-id="root"]',
    'textarea'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Find the send button                                               */
/* ------------------------------------------------------------------ */

function findSendButton() {
  const selectors = [
    // ChatGPT data-testid selector
    '[data-testid="send-button"]',
    'button[data-testid="send-button"]',
    // Aria label matches
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="submit"]',
    '[role="button"][aria-label*="Send"]',
    '[role="button"][aria-label*="send"]',
    '[role="button"][aria-label*="Submit"]',
    '[role="button"][aria-label*="submit"]'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // Fallback: look for a button near the textarea with an SVG send icon
  const form = document.querySelector('form');
  if (form) {
    const buttons = form.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      // Skip buttons that are clearly not send
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("attach") || label.includes("mic") || label.includes("image") || label.includes("search")) continue;

      // Look for buttons that contain an SVG (likely the send icon)
      if (btn.querySelector("svg") && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
        return btn;
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Wait for ChatGPT to finish responding                              */
/* ------------------------------------------------------------------ */

async function waitForResponseDone(submittedAt) {
  const POLL_INTERVAL = 500;   // ms
  const MAX_START_WAIT = 6000; // wait up to 6s for generation to start
  const MAX_GEN_WAIT = 180000; // wait up to 180s for generation to finish (ChatGPT can be slower)
  const BUFFER_AFTER = 1500;   // extra buffer after completion

  // 1. Wait for generation to start (either stop button appears, send button disabled, or streaming indicators appear)
  let started = false;
  const startDeadline = Date.now() + MAX_START_WAIT;
  
  while (Date.now() < startDeadline) {
    if (hasGenerationStarted()) {
      started = true;
      break;
    }
    await delay(POLL_INTERVAL);
  }

  // 2. Wait for generation to finish (stop button gone, send button active, and streaming elements gone)
  const genDeadline = Date.now() + MAX_GEN_WAIT;
  while (Date.now() < genDeadline) {
    if (started) {
      if (!isCurrentlyGenerating()) {
        break; // Generation finished!
      }
    } else {
      // If it never started (e.g. failed or completed instantly), break
      break;
    }
    await delay(POLL_INTERVAL);
  }

  // 3. Extra safety buffer
  await delay(BUFFER_AFTER);
}

function hasGenerationStarted() {
  if (findStopButton()) return true;
  
  const sendBtn = findSendButton();
  if (sendBtn) {
    const isDisabled = sendBtn.disabled ||
                       sendBtn.getAttribute("aria-disabled") === "true" ||
                       window.getComputedStyle(sendBtn).display === "none";
    if (isDisabled) return true;
  }

  const streamingEl = document.querySelector('[class*="streaming"]') ||
                      document.querySelector('[class*="result-streaming"]');
  if (streamingEl) return true;

  if (isDalleGenerating()) return true;

  return false;
}

function isCurrentlyGenerating() {
  if (findStopButton()) return true;
  
  const sendBtn = findSendButton();
  if (sendBtn) {
    const isDisabled = sendBtn.disabled ||
                       sendBtn.getAttribute("aria-disabled") === "true" ||
                       window.getComputedStyle(sendBtn).display === "none";
    if (isDisabled) return true;
  }

  const streamingEl = document.querySelector('[class*="streaming"]') ||
                      document.querySelector('[class*="result-streaming"]');
  if (streamingEl) return true;

  if (isDalleGenerating()) return true;

  return false;
}

function isDalleGenerating() {
  // Check if "Creating image", "Finishing touches", "Processing image", etc. is present in the DOM
  // but exclude user messages.
  const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  for (const msg of assistantMessages) {
    const text = msg.textContent || msg.innerText || "";
    if (text.includes("Creating image") || 
        text.includes("Finishing touches") || 
        text.includes("Processing image")) {
      return true;
    }
  }

  // Fallback: search for generic loading or thought elements containing these texts
  const loadElements = document.querySelectorAll('.generating, .loading, [class*="generating"], [class*="loading"], [class*="thought"]');
  for (const el of loadElements) {
    const text = el.textContent || el.innerText || "";
    if (text.includes("Creating image") || 
        text.includes("Finishing touches") || 
        text.includes("Processing image")) {
      return true;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Find the stop generating button                                    */
/* ------------------------------------------------------------------ */

function findStopButton() {
  // ChatGPT-specific stop button
  const testIdBtn = document.querySelector('[data-testid="stop-button"], button[data-testid="stop-button"]');
  if (testIdBtn) return testIdBtn;

  // Aria label fallback
  const elements = document.querySelectorAll('button, [role="button"], [aria-label*="Stop"], [aria-label*="stop"]');
  for (const el of elements) {
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("stop")) return el;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
