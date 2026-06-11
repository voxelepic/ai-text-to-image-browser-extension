/**
 * Thin wrappers around chrome.storage.session for prompt queue state.
 *
 * State shape: { prompts: string[], currentIndex: number, running: boolean, delay: number }
 */

const QUEUE_KEY = "promptQueue";

/**
 * Saves the current queue state to session storage.
 * @param {{ prompts: string[], currentIndex: number, running: boolean, delay: number }} state
 */
export async function saveQueue(state) {
  await chrome.storage.session.set({ [QUEUE_KEY]: state });
}

/**
 * Loads the queue state from session storage.
 * @returns {Promise<{ prompts: string[], currentIndex: number, running: boolean, delay: number } | null>}
 */
export async function loadQueue() {
  const result = await chrome.storage.session.get(QUEUE_KEY);
  return result[QUEUE_KEY] || null;
}

/**
 * Clears the queue state from session storage.
 */
export async function clearQueue() {
  await chrome.storage.session.remove(QUEUE_KEY);
}

/**
 * Generates a unique key for the history map.
 */
function getHistoryKey(sheetUrl, tabName) {
  const cleanUrl = (sheetUrl || "").trim().replace(/[^a-zA-Z0-9]/g, "_");
  const cleanTab = (tabName || "Sheet1").trim().replace(/[^a-zA-Z0-9]/g, "_");
  return `promptHistory_${cleanUrl}_${cleanTab}`;
}

/**
 * Saves history progress for a specific sheet/tab.
 */
export async function saveHistoryState(sheetUrl, tabName, historyState) {
  const key = getHistoryKey(sheetUrl, tabName);
  await chrome.storage.local.set({ [key]: historyState });
}

/**
 * Loads history progress for a specific sheet/tab.
 */
export async function getHistoryState(sheetUrl, tabName) {
  const key = getHistoryKey(sheetUrl, tabName);
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

/**
 * Clears history progress for a specific sheet/tab.
 */
export async function clearHistoryState(sheetUrl, tabName) {
  const key = getHistoryKey(sheetUrl, tabName);
  await chrome.storage.local.remove(key);
}
