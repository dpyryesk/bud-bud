/**
 * Normalize a transaction name for matching/grouping purposes.
 *
 * Rules applied:
 * 1. Convert to lowercase
 * 2. Remove sequences of 6+ digits (reference numbers, transaction IDs)
 * 3. Remove common bank transaction prefixes
 * 4. Collapse multiple spaces into a single space
 * 5. Trim whitespace
 */
export function normalizeTransactionName(name: string): string {
  let normalized = name.toLowerCase();

  // Remove sequences of 6+ digits (reference/transaction IDs)
  normalized = normalized.replace(/\d{6,}/g, '');

  // Remove common card number patterns (last 4 digits like *1234 or x1234)
  normalized = normalized.replace(/[*x]\d{4}/g, '');

  // Remove standalone short number sequences that look like codes (2-5 digits surrounded by spaces)
  normalized = normalized.replace(/\s\d{2,5}\s/g, ' ');

  // Collapse multiple spaces into one
  normalized = normalized.replace(/\s+/g, ' ');

  // Trim
  normalized = normalized.trim();

  return normalized;
}
