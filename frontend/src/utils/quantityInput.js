/**
 * Helpers for controlled numeric quantity fields (stock, release qty, etc.).
 */

/** Allow only digits; empty string preserved (while clearing the field). */
export function normalizeQuantityInputString(value) {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}

/** Non-negative integer; empty or invalid → 0. */
export function intFromQuantityInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits === '') return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Non-negative integer, or '' when the field is blank (optional qty UIs). */
export function intFromQuantityInputOrEmpty(value) {
  const raw = String(value ?? '');
  const digits = raw.replace(/\D/g, '');
  if (digits === '') {
    return raw === '' ? '' : 0;
  }
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
