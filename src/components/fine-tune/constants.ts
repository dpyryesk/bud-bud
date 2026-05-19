import type { FineTuneStats, FineTuneMonthlyDataPoint, FitStatus } from '@/types';
import { getYearlyAmount } from '@/lib/date-utils';
import type { BudgetPeriodType } from '@/lib/date-utils';

// ---- Month-key formatters (no Date objects — avoids local-timezone drift) ----
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Format a 'yyyy-MM' key as a short label, e.g. 'Jan 26'. */
export function formatMonthKeyShort(monthKey: string): string {
  const [yrStr, moStr] = monthKey.split('-');
  const yr = parseInt(yrStr ?? '', 10);
  const mo = parseInt(moStr ?? '', 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) return monthKey;
  return `${MONTH_SHORT[mo - 1]} ${String(yr).slice(-2)}`;
}

/** Format a 'yyyy-MM' key as a full label, e.g. 'January 2026'. */
export function formatMonthKeyLong(monthKey: string): string {
  const [yrStr, moStr] = monthKey.split('-');
  const yr = parseInt(yrStr ?? '', 10);
  const mo = parseInt(moStr ?? '', 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) return monthKey;
  return `${MONTH_LONG[mo - 1]} ${yr}`;
}

// ---- Threshold constants ----

export const CV_LOW_THRESHOLD = 0.15;
export const CV_HIGH_THRESHOLD = 0.4;

export const FIT_GREEN_THRESHOLD = 0.1; // ≤ 10% delta → green
export const FIT_YELLOW_THRESHOLD = 0.25; // ≤ 25% delta → yellow

export const ROLLOVER_SUGGEST_CV_MAX = 0.2;
export const ANNUAL_PATTERN_MAX_NON_ZERO = 3;
export const ANNUAL_PATTERN_RATIO_MAX = 0.3;

// ---- Traffic-light types ----

// FitStatus is defined in @/types and re-exported for backward compatibility
export type { FitStatus };

export function getFitStatus(
  projectedYearly: number,
  expectedYearly: number,
  monthCount: number,
): FitStatus {
  if (monthCount < 2) return 'insufficient';
  if (expectedYearly === 0) return 'insufficient';
  const delta = Math.abs(projectedYearly - expectedYearly) / expectedYearly;
  if (delta <= FIT_GREEN_THRESHOLD) return 'green';
  if (delta <= FIT_YELLOW_THRESHOLD) return 'yellow';
  return 'red';
}

export const FIT_LABELS: Record<FitStatus, string> = {
  green: 'Good fit',
  yellow: 'Moderate fit',
  red: 'Poor fit',
  insufficient: 'Insufficient data',
};

export const FIT_DESCRIPTIONS: Record<FitStatus, string> = {
  green: 'Budget closely matches historical spending',
  yellow: 'Budget moderately matches historical spending',
  red: 'Budget significantly differs from historical spending',
  insufficient: 'Need at least 2 months of data to assess fit',
};

// ---- Variability label ----

export type VariabilityLevel = 'low' | 'moderate' | 'high' | 'na';

export function getVariabilityLevel(cv: number, monthCount: number): VariabilityLevel {
  if (monthCount < 2) return 'na';
  if (cv < CV_LOW_THRESHOLD) return 'low';
  if (cv <= CV_HIGH_THRESHOLD) return 'moderate';
  return 'high';
}

export const VARIABILITY_LABELS: Record<VariabilityLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  na: 'N/A',
};

// ---- Projection helpers ----

export function calcProjectedYearly(amount: number, period: BudgetPeriodType): number {
  return getYearlyAmount(amount, period);
}

export function calcMonthlyEquivalent(amount: number, period: BudgetPeriodType): number {
  return getYearlyAmount(amount, period) / 12;
}

// ---- Suggestion generation ----

export type Suggestion = {
  id: string;
  icon: string;
  message: string;
  severity: 'info' | 'warning' | 'tip';
};

export function generateSuggestions(
  stats: FineTuneStats,
  monthlyData: FineTuneMonthlyDataPoint[],
  draftAmount: number,
  draftPeriod: BudgetPeriodType,
  draftRollover: boolean,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const { average, cv, monthCount, nonZeroMonthCount } = stats;

  const projectedYearly = calcProjectedYearly(draftAmount, draftPeriod);
  const expectedYearly = average * 12;

  if (monthCount < 3) {
    suggestions.push({
      id: 'insufficient-data',
      icon: '📊',
      message: `Only ${monthCount} month${monthCount === 1 ? '' : 's'} of data — suggestions will improve with more history.`,
      severity: 'info',
    });
    return suggestions;
  }

  // Rollover suggestion
  if (cv < ROLLOVER_SUGGEST_CV_MAX && draftRollover) {
    suggestions.push({
      id: 'rollover-off',
      icon: '💡',
      message:
        'Spending is very consistent (low variability) — consider turning rollover OFF to keep the budget clean.',
      severity: 'tip',
    });
  }

  // Annual/infrequent pattern
  const isAnnualPattern =
    nonZeroMonthCount <= ANNUAL_PATTERN_MAX_NON_ZERO &&
    monthCount >= 6 &&
    nonZeroMonthCount / monthCount <= ANNUAL_PATTERN_RATIO_MAX;

  if (isAnnualPattern && draftPeriod !== 'yearly') {
    const monthsWithData = monthlyData
      .filter((m) => m.spending > 0)
      .map((m) => formatMonthKeyLong(m.month))
      .join(', ');
    suggestions.push({
      id: 'annual-pattern',
      icon: '📅',
      message: `Spending only occurs in ${nonZeroMonthCount} out of ${monthCount} months (${monthsWithData}). This looks like an infrequent or annual expense — consider setting period to Yearly.`,
      severity: 'tip',
    });
  }

  // High variability
  if (cv > CV_HIGH_THRESHOLD && draftPeriod !== 'yearly' && !draftRollover) {
    suggestions.push({
      id: 'high-variability',
      icon: '📈',
      message:
        'Spending is highly irregular. Consider enabling rollover to carry unused budget forward, or switching to a yearly period.',
      severity: 'warning',
    });
  }

  // Budget too generous
  if (expectedYearly > 0 && projectedYearly > expectedYearly * 1.25) {
    const suggestedMonthly = expectedYearly / 12;
    suggestions.push({
      id: 'budget-generous',
      icon: '⚠️',
      message: `Your budget may be too generous — history suggests ~$${suggestedMonthly.toFixed(0)}/month ($${expectedYearly.toFixed(0)}/year) based on past spending.`,
      severity: 'warning',
    });
  }

  // Budget too tight
  if (expectedYearly > 0 && projectedYearly < expectedYearly * 0.75) {
    const suggestedMonthly = expectedYearly / 12;
    suggestions.push({
      id: 'budget-tight',
      icon: '⚠️',
      message: `Your budget may be too tight — history suggests ~$${suggestedMonthly.toFixed(0)}/month ($${expectedYearly.toFixed(0)}/year) based on past spending.`,
      severity: 'warning',
    });
  }

  // No spending at all
  if (nonZeroMonthCount === 0 && monthCount >= 2) {
    suggestions.push({
      id: 'no-spending',
      icon: 'ℹ️',
      message:
        'No spending recorded for this budget line since the budget started. Make sure the right tags are linked.',
      severity: 'info',
    });
  }

  return suggestions;
}
