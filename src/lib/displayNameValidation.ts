/**
 * Display name validation and sanitization.
 *
 * Strips zalgo / excessive combining characters and blocks other
 * abusive Unicode ranges while still allowing normal international text.
 */

// Combining Diacritical Marks (U+0300–U+036F)
// Combining Diacritical Marks Extended (U+1AB0–U+1AFF)
// Combining Diacritical Marks Supplement (U+1DC0–U+1DFF)
// Combining Diacritical Marks for Symbols (U+20D0–U+20FF)
// Combining Half Marks (U+FE20–U+FE2F)
// We allow at most ONE combining mark per base character.
const COMBINING_MARKS =
  /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;

/**
 * Remove excessive combining / diacritical marks (zalgo text).
 * Keeps at most `maxPerBase` combining marks after each base character.
 */
function stripZalgo(input: string, maxPerBase = 1): string {
  let result = "";
  let combiningCount = 0;

  for (const char of input) {
    if (COMBINING_MARKS.test(char)) {
      // Reset lastIndex since we use .test() on a global regex
      COMBINING_MARKS.lastIndex = 0;
      if (combiningCount < maxPerBase) {
        result += char;
        combiningCount++;
      }
      // else: skip extra combining marks
    } else {
      combiningCount = 0;
      result += char;
    }
  }

  return result;
}

// Characters / ranges we explicitly block:
//  - Control chars (C0/C1) except common whitespace
//  - Zero-width chars (ZWJ, ZWNJ, ZWSP, WJ, etc.)
//  - Directional overrides & isolates
//  - Interlinear annotations
//  - Object replacement / replacement chars
//  - Tags block (U+E0000–U+E007F)
const BLOCKED_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\uFFFC\uFFFD]|\uDB40[\uDC00-\uDC7F]/g;

/** Maximum display name length */
export const DISPLAY_NAME_MAX_LENGTH = 32;

/**
 * Sanitize a display name string:
 * 1. Remove blocked invisible / control characters
 * 2. Strip zalgo (excessive combining marks)
 * 3. Collapse multiple spaces
 * 4. Trim
 * 5. Enforce max length
 */
export function sanitizeDisplayName(raw: string): string {
  let cleaned = raw.replace(BLOCKED_CHARS, "");
  cleaned = stripZalgo(cleaned, 1);
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.trim();
  cleaned = cleaned.slice(0, DISPLAY_NAME_MAX_LENGTH);
  return cleaned;
}

/**
 * Validate a (already-sanitized) display name.
 * Returns an error message string or null if valid.
 */
export function validateDisplayName(name: string): string | null {
  if (name.length > 0 && name.length < 2) {
    return "Display name must be at least 2 characters";
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`;
  }
  return null;
}
