import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  differenceInDays,
  format,
} from 'date-fns';

export type PeriodType = 'month' | 'year' | 'custom';

export type TimePeriod = {
  start: Date;
  end: Date;
  label: string;
  type: PeriodType;
};

export type BudgetPeriodType = 'monthly' | 'biweekly' | 'yearly';

/**
 * Get preset time periods.
 */
export function getPresetPeriods(): TimePeriod[] {
  const now = new Date();
  return [
    {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: 'Current Month',
      type: 'month',
    },
    {
      start: startOfMonth(subMonths(now, 1)),
      end: endOfMonth(subMonths(now, 1)),
      label: 'Last Month',
      type: 'month',
    },
    {
      start: startOfYear(now),
      end: endOfYear(now),
      label: 'Current Year',
      type: 'year',
    },
    {
      start: startOfYear(subYears(now, 1)),
      end: endOfYear(subYears(now, 1)),
      label: 'Last Year',
      type: 'year',
    },
  ];
}

/**
 * Get the default time period (current month).
 */
export function getDefaultPeriod(): TimePeriod {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
    label: format(now, 'MMMM yyyy'),
    type: 'month',
  };
}

/**
 * Scale a budget amount from its native period to the view period.
 *
 * @param amount - The budget amount in its native period
 * @param budgetPeriod - The native period of the budget (monthly, biweekly, yearly)
 * @param viewPeriod - The time period being viewed
 * @param anchorDate - (biweekly only) The payday anchor date used to determine
 *   exact period boundaries. When provided the biweekly case counts the number
 *   of pay-period **starts** that fall within the view window — correctly
 *   yielding 2 or 3 for monthly views instead of the naive days/14 approximation.
 *   When omitted the legacy proportional calculation is used (daysInView / 14).
 * @returns The scaled budget amount
 */
export function scaleBudgetAmount(
  amount: number,
  budgetPeriod: BudgetPeriodType,
  viewPeriod: TimePeriod,
  anchorDate?: Date,
): number {
  const daysInView = differenceInDays(viewPeriod.end, viewPeriod.start) + 1;

  switch (budgetPeriod) {
    case 'monthly': {
      // Use UTC month fields to avoid local-timezone day-shift on UTC-midnight boundaries.
      // date-fns differenceInCalendarMonths() is local-timezone-aware: a UTC midnight date
      // (e.g. 2026-01-01T00:00:00Z) appears as the previous calendar day in UTC-offset
      // timezones (Dec 31 in UTC-4/UTC-5), which inflates the month count by 1.
      const startUTCMonth = viewPeriod.start.getUTCFullYear() * 12 + viewPeriod.start.getUTCMonth();
      const endUTCMonth = viewPeriod.end.getUTCFullYear() * 12 + viewPeriod.end.getUTCMonth();
      const months = endUTCMonth - startUTCMonth + 1;
      return amount * months;
    }
    case 'biweekly': {
      if (anchorDate) {
        // Exact count: how many bi-weekly pay-period starts fall within the view window?
        // This correctly returns 2 or 3 for monthly views depending on the anchor rhythm.
        const startDay = new Date(
          Date.UTC(
            viewPeriod.start.getUTCFullYear(),
            viewPeriod.start.getUTCMonth(),
            viewPeriod.start.getUTCDate(),
          ),
        );
        const endDay = new Date(
          Date.UTC(
            viewPeriod.end.getUTCFullYear(),
            viewPeriod.end.getUTCMonth(),
            viewPeriod.end.getUTCDate(),
          ),
        );
        const count = generateBiWeeklyPeriods(anchorDate, startDay, endDay).length;
        return amount * count;
      }
      // Fallback: legacy proportional calculation (no anchor available)
      const biweeks = daysInView / 14;
      return amount * biweeks;
    }
    case 'yearly': {
      // Calculate fraction of a year
      const yearFraction = daysInView / 365.25;
      return amount * yearFraction;
    }
    default:
      return amount;
  }
}

/**
 * Get the number of complete periods between a start date and the current period.
 * Used for rollover calculations.
 *
 * @param budgetPeriod - The recurrence type of the budget line.
 * @param fromDate     - Start of the history range (inclusive).
 * @param toDate       - End of the history range (exclusive — the current view-period start).
 * @param anchorDate   - (biweekly only) The payday anchor. When provided, periods are
 *                       computed from real pay-period boundaries via
 *                       `generateBiWeeklyPeriods`. When omitted, a fixed 14-day stride
 *                       from `fromDate` is used (legacy fallback).
 */
export function getCompletePeriodsBetween(
  budgetPeriod: BudgetPeriodType,
  fromDate: Date,
  toDate: Date,
  anchorDate?: Date,
): { start: Date; end: Date }[] {
  const periods: { start: Date; end: Date }[] = [];

  const utcMonthStart = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));

  const utcMonthEnd = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const utcYearStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

  const utcYearEnd = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

  if (budgetPeriod === 'monthly') {
    let current = utcMonthStart(fromDate);
    const endLimit = utcMonthStart(toDate);

    while (current < endLimit) {
      periods.push({
        start: current,
        end: utcMonthEnd(current),
      });
      current = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1, 0, 0, 0, 0),
      );
    }
  } else if (budgetPeriod === 'biweekly') {
    if (anchorDate) {
      // Anchor-aligned: use real pay-period boundaries so that rollover slices
      // match the same windows used by scaleBudgetAmount(anchorDate).
      // Include only periods whose end is strictly before toDate (i.e. "complete"
      // periods that fall entirely before the current view period starts).
      const fromDay = new Date(
        Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()),
      );
      const toDay = new Date(
        Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()),
      );
      // Generate all anchor-aligned periods that start in [fromDay, toDay).
      // The last period whose start is before toDay may extend past toDay — that
      // is fine because we filter by end < toDate below.
      const biweeklyPeriods = generateBiWeeklyPeriods(anchorDate, fromDay, toDay);
      for (const p of biweeklyPeriods) {
        // Only include periods that are fully complete (end is before the view start).
        if (p.end < toDate) {
          periods.push({ start: p.start, end: p.end });
        }
      }
    } else {
      // Legacy fallback: fixed 14-day stride from fromDate (no anchor available).
      let current = new Date(
        Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()),
      );
      while (current < toDate) {
        const periodEnd = new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate() + 13,
            23,
            59,
            59,
            999,
          ),
        );
        if (periodEnd < toDate) {
          periods.push({ start: new Date(current), end: periodEnd });
        }
        current = new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 14),
        );
      }
    }
  } else if (budgetPeriod === 'yearly') {
    let current = utcYearStart(fromDate);
    const endLimit = utcYearStart(toDate);

    while (current < endLimit) {
      periods.push({
        start: current,
        end: utcYearEnd(current),
      });
      current = new Date(Date.UTC(current.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
    }
  }

  return periods;
}

/**
 * Format a period label for display.
 */
export function formatPeriodLabel(period: TimePeriod): string {
  if (period.label) return period.label;
  return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`;
}

/**
 * Convert a budget amount to its yearly equivalent.
 * monthly × 12, biweekly × 26, yearly × 1.
 */
export function getYearlyAmount(amount: number, period: BudgetPeriodType): number {
  switch (period) {
    case 'monthly':
      return amount * 12;
    case 'biweekly':
      return amount * 26;
    case 'yearly':
      return amount;
    default:
      return amount;
  }
}

/**
 * Format currency amount.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

/**
 * Parse an HTML date input value (`YYYY-MM-DD`) into a Date at UTC midnight.
 *
 * This avoids environment-dependent parsing behavior and keeps date-only
 * values stable across server/client time zones.
 */
export function parseDateInputAsUtc(dateInput: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) {
    return new Date(dateInput);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

/**
 * Format an ISO datetime string as a local date for display, preserving the
 * calendar day from the ISO date portion (no timezone day-shift).
 */
export function formatIsoDateForDisplay(iso: string, pattern = 'MMM d, yyyy'): string {
  const datePart = iso.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) {
    return format(new Date(iso), pattern);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return format(new Date(year, monthIndex, day), pattern);
}

// ---------------------------------------------------------------------------
// Bi-weekly period helpers
// ---------------------------------------------------------------------------

export type BiWeeklyPeriod = {
  /** Start of the period (UTC midnight, inclusive). */
  start: Date;
  /** End of the period (UTC 23:59:59.999, inclusive). */
  end: Date;
  /**
   * Sequence number of this period relative to the anchor date (0-based).
   * Period 0 is the anchor period itself.
   */
  sequenceNumber: number;
  /**
   * True when this period is the 3rd paycheck in a calendar month – i.e. when
   * 3 bi-weekly period *starts* fall inside the same UTC calendar month.
   */
  isThirdPaycheck: boolean;
};

/**
 * Build a UTC date at midnight.
 */
function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Build a UTC date at end-of-day (23:59:59.999).
 */
function utcDayEnd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
}

/**
 * Generate a sequence of bi-weekly (14-day) pay periods anchored to
 * `anchorDate`. Periods are produced for the range [`from`, `to`] inclusive;
 * any period whose **start** date falls within that range is included even if
 * its end extends beyond `to`.
 *
 * All date arithmetic is done in UTC so results are timezone-agnostic.
 *
 * @param anchorDate  - The payday that establishes the recurrence rhythm.
 *                      Only the calendar date (UTC) is used; time is ignored.
 * @param from        - Range start (UTC calendar date).
 * @param to          - Range end (UTC calendar date).
 */
export function generateBiWeeklyPeriods(anchorDate: Date, from: Date, to: Date): BiWeeklyPeriod[] {
  // Normalise all inputs to UTC midnight.
  const anchorMs = Date.UTC(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth(),
    anchorDate.getUTCDate(),
  );
  const fromMs = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toMs = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());

  const PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days in ms

  // Find the sequence number of the first period whose start <= fromMs.
  // sequence n → start = anchorMs + n * PERIOD_MS
  // We want the largest n such that anchorMs + n*PERIOD_MS <= fromMs
  const rawSeq = Math.floor((fromMs - anchorMs) / PERIOD_MS);
  // Ensure we don't overshoot (handles dates before the anchor).
  let seq = rawSeq;
  while (anchorMs + seq * PERIOD_MS > fromMs) seq--;
  while (anchorMs + (seq + 1) * PERIOD_MS <= fromMs) seq++;

  const periods: BiWeeklyPeriod[] = [];

  // Track how many period starts each (year, month) key has seen.
  const startsPerMonth = new Map<string, number>();

  // We need to scan far enough to classify every period start as 3rd-paycheck
  // or not, which requires knowing all siblings in the same month. We do two
  // passes: first collect all starts, then build the final array.

  // Collect all period starts that fall in the range [fromMs, toMs].
  // `seq` is the index of the period whose start is <= fromMs; we begin
  // iterating there and the `pStartMs >= fromMs` guard below skips any
  // period that starts strictly before `from`.
  const collected: { seqN: number; startMs: number }[] = [];
  for (let n = seq; ; n++) {
    const pStartMs = anchorMs + n * PERIOD_MS;
    if (pStartMs > toMs) break;
    if (pStartMs >= fromMs) {
      collected.push({ seqN: n, startMs: pStartMs });
    }
  }

  // Count starts per calendar month for the "3rd paycheck" classification.
  for (const { startMs: sMs } of collected) {
    const d = new Date(sMs);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    startsPerMonth.set(key, (startsPerMonth.get(key) ?? 0) + 1);
  }

  // Track ordinal within each month to know which is the 3rd.
  const ordinalPerMonth = new Map<string, number>();

  for (const { seqN, startMs: sMs } of collected) {
    const startDate = new Date(sMs);
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth();
    const day = startDate.getUTCDate();

    const monthKey = `${year}-${month}`;
    const monthCount = startsPerMonth.get(monthKey) ?? 1;
    const ordinal = (ordinalPerMonth.get(monthKey) ?? 0) + 1;
    ordinalPerMonth.set(monthKey, ordinal);

    const endDate = new Date(sMs + PERIOD_MS - 1); // 13 days 23:59:59.999

    periods.push({
      start: utcDay(year, month, day),
      end: utcDayEnd(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
      sequenceNumber: seqN,
      isThirdPaycheck: monthCount >= 3 && ordinal === 3,
    });
  }

  return periods;
}

/**
 * Return all bi-weekly periods (from `generateBiWeeklyPeriods`) whose
 * **start** date falls inside the given UTC calendar month.
 *
 * @param anchorDate  - The payday anchor; see `generateBiWeeklyPeriods`.
 * @param year        - UTC calendar year (e.g. 2026).
 * @param month       - UTC calendar month, 0-based (0 = January … 11 = December).
 */
export function getPeriodsOverlappingMonth(
  anchorDate: Date,
  year: number,
  month: number,
): BiWeeklyPeriod[] {
  const from = utcDay(year, month, 1);
  // Last day of the month: day 0 of next month.
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const toDay = utcDay(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return generateBiWeeklyPeriods(anchorDate, from, toDay);
}

/**
 * Return the number of bi-weekly paychecks that start in the given UTC
 * calendar month. This is 2 in most months, 3 in "3rd paycheck" months.
 *
 * @param anchorDate  - The payday anchor; see `generateBiWeeklyPeriods`.
 * @param year        - UTC calendar year.
 * @param month       - UTC calendar month, 0-based.
 */
export function countBiWeeklyPeriodsInMonth(anchorDate: Date, year: number, month: number): number {
  return getPeriodsOverlappingMonth(anchorDate, year, month).length;
}

/**
 * Returns `true` when the given UTC calendar month contains 3 bi-weekly pay
 * period starts (i.e. it is a "3rd paycheck" month for the given anchor).
 *
 * @param anchorDate  - The payday anchor; see `generateBiWeeklyPeriods`.
 * @param year        - UTC calendar year.
 * @param month       - UTC calendar month, 0-based.
 */
export function isThirdPaycheckMonth(anchorDate: Date, year: number, month: number): boolean {
  return countBiWeeklyPeriodsInMonth(anchorDate, year, month) === 3;
}

/**
 * Build an ordered list of `"YYYY-MM"` strings from `start` up to and
 * including the month identified by `lastCompleteYear`/`lastCompleteMonth`
 * (both UTC, month 0-indexed).
 *
 * All arithmetic is done in UTC to avoid local-timezone drift.
 */
export function buildMonthList(
  start: Date,
  lastCompleteYear: number,
  lastCompleteMonth: number,
): string[] {
  const months: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth(); // 0-indexed
  while (y < lastCompleteYear || (y === lastCompleteYear && m <= lastCompleteMonth)) {
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return months;
}
