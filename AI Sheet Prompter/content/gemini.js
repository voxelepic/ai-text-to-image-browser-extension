/**
 * Content script injected into gemini.google.com/app.
 * Handles DOM interaction: typing prompts, clicking send, waiting for response.
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
    throw new Error("Could not find Gemini input field. The UI may have changed.");
  }

  // 2. Focus and set text
  inputField.focus();
  inputField.innerText = text;

  // 3. Dispatch synthetic events so React picks up the change
  inputField.dispatchEvent(new Event("input", { bubbles: true }));
  inputField.dispatchEvent(new Event("change", { bubbles: true }));

  // Also dispatch InputEvent for frameworks that listen to it
  inputField.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: text
  }));

  // 4. Wait for React to process
  await delay(300);

  // 5. Find and click the send button
  const sendButton = findSendButton();
  if (!sendButton) {
    throw new Error("Could not find the Send button. The UI may have changed.");
  }

  // Click the send button exactly once to prevent double-submitting / duplicate prompt spam
  sendButton.click();

  // 6. Record submission time
  const submittedAt = Date.now();

  // 7. Wait for response to finish
  await waitForResponseDone(submittedAt);
}

/* ------------------------------------------------------------------ */
/*  Find the input field                                               */
/* ------------------------------------------------------------------ */

function findInputField() {
  const selectors = [
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"].ql-editor',
    'div[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
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
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[data-test-id*="send"]',
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

  // Fallback: look for a button with a send-looking SVG/icon near the input area
  // Try buttons with jsname attribute inside common input containers
  const inputContainers = document.querySelectorAll(
    'rich-textarea, .input-area, [class*="input"], [class*="prompt"]'
  );
  for (const container of inputContainers) {
    const parent = container.closest('[class*="input-area"], [class*="bottom"], [class*="footer"]') || container.parentElement;
    if (parent) {
      const buttons = parent.querySelectorAll("button[jsname], [role=\"button\"][jsname]");
      for (const btn of buttons) {
        // Skip buttons that are clearly not send (like attach, mic, etc.)
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("attach") || label.includes("mic") || label.includes("image")) continue;
        return btn;
      }
    }
  }

  // Last resort: find any enabled button with jsname near the bottom of the page
  const allButtons = document.querySelectorAll("button[jsname], [role=\"button\"][jsname]");
  for (const btn of allButtons) {
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("send") || label.includes("submit")) return btn;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Wait for Gemini to finish responding                               */
/* ------------------------------------------------------------------ */

async function waitForResponseDone(submittedAt) {
  const POLL_INTERVAL = 500;   // ms
  const MAX_START_WAIT = 6000; // wait up to 6s for generation to start
  const MAX_GEN_WAIT = 120000; // wait up to 120s for generation to finish
  const BUFFER_AFTER = 1500;   // extra buffer after completion

  // 1. Wait for generation to start (either stop button appears or send button is disabled/hidden)
  let started = false;
  const startDeadline = Date.now() + MAX_START_WAIT;
  
  while (Date.now() < startDeadline) {
    if (hasGenerationStarted()) {
      started = true;
      break;
    }
    await delay(POLL_INTERVAL);
  }

  // 2. Wait for generation to finish (stop button gone and send button active/visible)
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
                       sendBtn.classList.contains("disabled") ||
                       window.getComputedStyle(sendBtn).display === "none";
    if (isDisabled) return true;
  }
  return false;
}

function isCurrentlyGenerating() {
  if (findStopButton()) return true;
  
  const sendBtn = findSendButton();
  if (sendBtn) {
    const isDisabled = sendBtn.disabled ||
                       sendBtn.getAttribute("aria-disabled") === "true" ||
                       sendBtn.classList.contains("disabled") ||
                       window.getComputedStyle(sendBtn).display === "none";
    if (isDisabled) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Find the stop generating button                                    */
/* ------------------------------------------------------------------ */

function findStopButton() {
  // Look for any element (button or div wrapper) whose aria-label contains "Stop" or "stop"
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
