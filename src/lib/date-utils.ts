import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  differenceInDays,
  differenceInCalendarMonths,
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
 * @returns The scaled budget amount
 */
export function scaleBudgetAmount(
  amount: number,
  budgetPeriod: BudgetPeriodType,
  viewPeriod: TimePeriod,
): number {
  const daysInView = differenceInDays(viewPeriod.end, viewPeriod.start) + 1;

  switch (budgetPeriod) {
    case 'monthly': {
      // Calculate how many months (fractional) the view period spans
      const months = differenceInCalendarMonths(viewPeriod.end, viewPeriod.start) + 1;
      return amount * months;
    }
    case 'biweekly': {
      // 26 biweekly periods per year, each is ~14.077 days
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
 */
export function getCompletePeriodsBetween(
  budgetPeriod: BudgetPeriodType,
  fromDate: Date,
  toDate: Date,
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
    // Start from the given date and step by 14 days (UTC arithmetic — matches monthly/yearly)
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
