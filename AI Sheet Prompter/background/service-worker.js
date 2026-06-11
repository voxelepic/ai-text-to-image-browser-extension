/**
 * Background service worker — owns the prompt queue.
 *
 * All state is persisted in chrome.storage.session so it survives popup close
 * and service worker restarts.
 *
 * Supports routing prompts to either Gemini or ChatGPT based on targetAI.
 */

import { saveQueue, loadQueue, saveHistoryState, clearHistoryState } from "../utils/storage.js";

/* ------------------------------------------------------------------ */
/*  Target AI configuration                                            */
/* ------------------------------------------------------------------ */

const AI_TARGETS = {
  gemini: {
    name: "Gemini",
    tabUrlPattern: "https://gemini.google.com/*",
    openUrl: "https://gemini.google.com/app"
  },
  chatgpt: {
    name: "ChatGPT",
    tabUrlPattern: "https://chatgpt.com/*",
    openUrl: "https://chatgpt.com"
  }
};

/* ------------------------------------------------------------------ */
/*  Extension Initialization                                           */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener((details) => {
  console.log("AI Sheet Prompter installed/updated. Reason:", details.reason);
  chrome.storage.sync.get("targetAI", (result) => {
    if (!result.targetAI) {
      chrome.storage.sync.set({ targetAI: "gemini" });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Message handling                                                   */
/* ------------------------------------------------------------------ */

let isSendingPrompt = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {

    /* ---- From popup ---- */
    case "start":
      handleStart(msg.prompts, msg.delay, msg.targetAI || "gemini", msg.sheetUrl, msg.tabName, msg.startIndex)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async response

    case "stop":
      handleStop()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true; // async response

    /* ---- From content script ---- */
    case "promptDone":
      handlePromptDone()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true; // async response

    case "promptError":
      handlePromptError(msg.error)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true; // async response

    /* ---- From popup requesting current state ---- */
    case "getState":
      loadQueue().then(state => {
        sendResponse({ state });
      });
      return true; // async response

    default:
      return false;
  }
});

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

async function handleStart(prompts, delay, targetAI, sheetUrl, tabName, startIndex = 0) {
  const state = {
    prompts,
    currentIndex: startIndex || 0,
    running: true,
    delay,
    targetAI,
    busy: false,
    sheetUrl,
    tabName
  };
  isSendingPrompt = false;
  await saveQueue(state);
  await sendNextPrompt(state, true);
}

/* ------------------------------------------------------------------ */
/*  Stop                                                               */
/* ------------------------------------------------------------------ */

async function handleStop(broadcast = true) {
  isSendingPrompt = false;
  await chrome.alarms.clear("nextPromptAlarm");
  const state = await loadQueue();
  if (state) {
    state.running = false;
    state.busy = false;
    await saveQueue(state);
  }
  if (broadcast) {
    broadcastToPopup({ action: "stopped" });
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt lifecycle                                                   */
/* ------------------------------------------------------------------ */

async function handlePromptDone() {
  isSendingPrompt = false;
  const state = await loadQueue();
  if (!state || !state.running) return;

  state.currentIndex++;
  state.busy = false;
  await saveQueue(state);

  if (state.sheetUrl && state.tabName) {
    if (state.currentIndex >= state.prompts.length) {
      await clearHistoryState(state.sheetUrl, state.tabName);
    } else {
      await saveHistoryState(state.sheetUrl, state.tabName, {
        currentIndex: state.currentIndex,
        promptsCount: state.prompts.length
      });
    }
  }

  if (state.currentIndex >= state.prompts.length) {
    // All done
    state.running = false;
    await saveQueue(state);
    broadcastToPopup({ action: "allDone" });
    return;
  }

  // Notify popup of progress
  broadcastToPopup({
    action: "progress",
    current: state.currentIndex + 1,
    total: state.prompts.length
  });

  // Register alarm for the next prompt (alarms expect delay in minutes)
  const delayInMinutes = state.delay / 60000;
  await chrome.alarms.clear("nextPromptAlarm"); // clean up any existing alarm
  chrome.alarms.create("nextPromptAlarm", { delayInMinutes });
}

async function handlePromptError(errorMessage) {
  broadcastToPopup({
    action: "error",
    message: `Prompt failed: ${errorMessage}`
  });
  // Treat as done — advance to next prompt so one failure doesn't stall the queue
  await handlePromptDone();
}

/* ------------------------------------------------------------------ */
/*  Send a prompt to the target AI content script                     */
/* ------------------------------------------------------------------ */

async function sendNextPrompt(state, isStart = false) {
  if (isSendingPrompt) {
    console.log("Already sending prompt (lock active), ignoring duplicate trigger.");
    return;
  }
  if (!state) {
    state = await loadQueue();
  }
  if (!state || !state.running || state.busy) {
    console.log("Queue not running or already busy, ignoring.");
    return;
  }

  isSendingPrompt = true;
  state.busy = true;
  await saveQueue(state);

  const targetAI = state.targetAI || "gemini";
  const targetTab = await findTargetTab(targetAI);
  const targetConfig = AI_TARGETS[targetAI] || AI_TARGETS.gemini;

  if (!targetTab) {
    const errorMsg = `No ${targetConfig.name} tab open. Open ${targetConfig.openUrl} first.`;
    isSendingPrompt = false;
    state.busy = false;
    await saveQueue(state);
    if (isStart) {
      await handleStop(false);
      throw new Error(errorMsg);
    } else {
      broadcastToPopup({
        action: "error",
        message: errorMsg
      });
      await handleStop();
      return;
    }
  }

  const text = state.prompts[state.currentIndex];

  // Notify popup of progress
  broadcastToPopup({
    action: "progress",
    current: state.currentIndex + 1,
    total: state.prompts.length
  });

  // Use responseCallback as per chrome-extension-developer guidelines
  chrome.tabs.sendMessage(targetTab.id, {
    action: "sendPrompt",
    text
  }, (response) => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message;
      isSendingPrompt = false;
      broadcastToPopup({
        action: "error",
        message: `Could not communicate with ${targetConfig.name} tab: ${errMsg}. Try refreshing the page.`
      });
      handleStop();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Find the target AI tab                                             */
/* ------------------------------------------------------------------ */

async function findTargetTab(targetAI) {
  const config = AI_TARGETS[targetAI] || AI_TARGETS.gemini;

  // 1. Try to find the active tab in the current window first
  const activeTabsCurrentWindow = await chrome.tabs.query({ url: config.tabUrlPattern, active: true, currentWindow: true });
  if (activeTabsCurrentWindow.length > 0) {
    return activeTabsCurrentWindow[0];
  }

  // 2. Try to find any active tab across all windows
  const activeTabs = await chrome.tabs.query({ url: config.tabUrlPattern, active: true });
  if (activeTabs.length > 0) {
    return activeTabs[0];
  }

  // 3. Fallback to any tab matching the url pattern
  const tabs = await chrome.tabs.query({ url: config.tabUrlPattern });
  return tabs.length > 0 ? tabs[0] : null;
}

/* ------------------------------------------------------------------ */
/*  Broadcast to popup (best-effort — popup may be closed)            */
/* ------------------------------------------------------------------ */

function broadcastToPopup(msg) {
  chrome.runtime.sendMessage(msg, () => {
    if (chrome.runtime.lastError) {
      // Ignore errors when the popup is closed (no receiving end)
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Alarm Listener for queue delay                                     */
/* ------------------------------------------------------------------ */

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "nextPromptAlarm") {
    const state = await loadQueue();
    if (state && state.running) {
      await sendNextPrompt(state);
    }
  }
});
