import { RE2 } from 're2-wasm';
import { MAX_REGEX_PATTERN_LENGTH } from '@/lib/regex-limits';

export { MAX_REGEX_PATTERN_LENGTH } from '@/lib/regex-limits';

export type AutoTagMatchType = 'exact' | 'regex';

export function compileSafeRegex(pattern: string): RE2 {
  if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new SyntaxError(`Regex patterns must contain 1-${MAX_REGEX_PATTERN_LENGTH} characters`);
  }
  return new RE2(pattern, 'iu');
}

export function matchesAutoTagPattern(
  value: string,
  pattern: string,
  matchType: AutoTagMatchType,
): boolean {
  if (matchType === 'exact') {
    return value.toLocaleLowerCase() === pattern.toLocaleLowerCase();
  }
  return compileSafeRegex(pattern).test(value);
}
