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

  if (budgetPeriod === 'monthly') {
    let current = startOfMonth(fromDate);
    const endLimit = startOfMonth(toDate);

    while (current < endLimit) {
      periods.push({
        start: current,
        end: endOfMonth(current),
      });
      current = startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    }
  } else if (budgetPeriod === 'biweekly') {
    // Start from the given date and step by 14 days
    let current = new Date(fromDate);
    while (current < toDate) {
      const periodEnd = new Date(current);
      periodEnd.setDate(periodEnd.getDate() + 13);
      if (periodEnd < toDate) {
        periods.push({ start: new Date(current), end: periodEnd });
      }
      current.setDate(current.getDate() + 14);
    }
  } else if (budgetPeriod === 'yearly') {
    let current = startOfYear(fromDate);
    const endLimit = startOfYear(toDate);

    while (current < endLimit) {
      periods.push({
        start: current,
        end: endOfYear(current),
      });
      current = startOfYear(new Date(current.getFullYear() + 1, 0, 1));
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
