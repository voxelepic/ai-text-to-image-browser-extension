/**
 * Fetches prompts from a publicly-shared Google Sheet via CSV export.
 *
 * @param {string} sheetUrl - Full Google Sheets URL or just the sheet ID.
 * @param {string} [tab="Sheet1"] - The tab/sheet name to read from.
 * @param {string} [column="B"] - Column letter (e.g. "B") or header name to read prompts from.
 * @returns {Promise<string[]>} Array of prompt strings from the specified column (skipping header + blanks).
 */
export async function fetchPrompts(sheetUrl, tab = "Sheet1", column = "B") {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error("Invalid Google Sheets URL or ID. Expected a URL like https://docs.google.com/spreadsheets/d/SHEET_ID/... or just the sheet ID.");
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  let response;
  try {
    response = await fetch(csvUrl);
  } catch (error) {
    throw new Error(
      "Failed to fetch sheet. This usually means the Google Sheet is private/restricted, or you are logged out of Google on this Chrome profile. Please share the sheet as 'Anyone with the link can view' or log in to your Google Account."
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet (HTTP ${response.status}). Make sure the sheet is publicly shared.`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return [];
  }

  // Determine which column index to read
  let targetColIndex = -1;
  
  // 1. Try to parse as Excel column letters (A, B, Z, AA, etc.)
  const colLetterIdx = columnLetterToIndex(column);
  if (colLetterIdx !== -1) {
    targetColIndex = colLetterIdx;
  } else {
    // 2. Try to match the header row values case-insensitively
    const headerRow = rows[0];
    const cleanQuery = column.trim().toLowerCase();
    targetColIndex = headerRow.findIndex(cell => cell.trim().toLowerCase() === cleanQuery);
  }

  // Fallback: If targetColIndex is out of range, search for a column header containing "prompt"
  if (targetColIndex === -1 || targetColIndex >= rows[0].length) {
    const headerRow = rows[0];
    targetColIndex = headerRow.findIndex(cell => cell.trim().toLowerCase().includes("prompt"));
  }

  // Final Fallback: Default to Column B (index 1) if available, otherwise Column A (index 0)
  if (targetColIndex === -1 || targetColIndex >= rows[0].length) {
    targetColIndex = rows[0].length > 1 ? 1 : 0;
  }

  const prompts = [];
  // Skip row 0 (header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && targetColIndex < row.length) {
      const val = row[targetColIndex];
      if (val && val.trim().length > 0) {
        prompts.push(val.trim());
      }
    }
  }

  return prompts;
}

/**
 * Extracts the Google Sheet ID from a full URL or returns the input if it
 * already looks like a bare ID (no slashes, alphanumeric + dashes/underscores).
 */
function extractSheetId(input) {
  if (!input || typeof input !== "string") return null;
  input = input.trim();

  // Full URL pattern: /spreadsheets/d/{ID}/...
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  // Bare ID — alphanumeric, dashes, underscores, reasonable length
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;

  // Handles links with /edit, /gviz, etc.
  return null;
}

/**
 * Converts an Excel column letter (e.g. "A", "B", "AA", "BC") to a 0-based column index.
 * Returns -1 if invalid column string.
 *
 * @param {string} letter
 * @returns {number}
 */
export function columnLetterToIndex(letter) {
  if (!letter || typeof letter !== "string") return -1;
  const cleaned = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(cleaned)) return -1;

  let index = 0;
  for (let i = 0; i < cleaned.length; i++) {
    index = index * 26 + (cleaned.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parses full CSV text into a 2D array of rows and columns,
 * correctly handling newlines inside quotes.
 *
 * @param {string} csvText
 * @returns {string[][]} 2D array of parsed CSV values
 */
export function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote
          currentField += '"';
          i += 2;
        } else {
          // Closing double quote
          insideQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === '\r' || char === '\n') {
        // Handle CRLF or LF
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";

        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Push final field/row if text doesn't end with a newline
  if (currentField || currentRow.length > 0 || insideQuotes) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

