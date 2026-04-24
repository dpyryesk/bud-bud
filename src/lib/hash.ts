/**
 * Generate a SHA-256 hash for duplicate detection of transactions.
 * Uses the Web Crypto API (available in Node.js 18+).
 */
export async function hashTransaction(fields: {
  date: string;
  name: string;
  debit: number;
  credit: number;
  source: string;
}): Promise<string> {
  const input = `${fields.date}|${fields.name}|${fields.debit}|${fields.credit}|${fields.source}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
