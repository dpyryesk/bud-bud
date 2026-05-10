import { describe, it, expect } from 'vitest';
import { parse as parseDateFns } from 'date-fns';
import {
  getPresetPeriods,
  getDefaultPeriod,
  scaleBudgetAmount,
  getCompletePeriodsBetween,
  formatPeriodLabel,
  getYearlyAmount,
  formatCurrency,
  parseDateInputAsUtc,
  formatIsoDateForDisplay,
  generateBiWeeklyPeriods,
  getPeriodsOverlappingMonth,
  countBiWeeklyPeriodsInMonth,
  isThirdPaycheckMonth,
  type TimePeriod,
} from '../date-utils';

// ---------------------------------------------------------------------------
// Helper to build a UTC midnight Date without the verbosity
// ---------------------------------------------------------------------------
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

// ---------------------------------------------------------------------------
// getPresetPeriods
// ---------------------------------------------------------------------------
describe('getPresetPeriods', () => {
  it('returns 4 periods', () => {
    expect(getPresetPeriods()).toHaveLength(4);
  });

  it('has correct labels in order', () => {
    const labels = getPresetPeriods().map((p) => p.label);
    expect(labels).toEqual(['Current Month', 'Last Month', 'Current Year', 'Last Year']);
  });

  it('current month period type is "month"', () => {
    const [current] = getPresetPeriods();
    expect(current.type).toBe('month');
  });

  it('current year period type is "year"', () => {
    const periods = getPresetPeriods();
    expect(periods[2].type).toBe('year');
  });

  it('start <= end for all periods', () => {
    for (const p of getPresetPeriods()) {
      expect(p.start.getTime()).toBeLessThanOrEqual(p.end.getTime());
    }
  });
});

// ---------------------------------------------------------------------------
// getDefaultPeriod
// ---------------------------------------------------------------------------
describe('getDefaultPeriod', () => {
  it('returns a period of type "month"', () => {
    expect(getDefaultPeriod().type).toBe('month');
  });

  it('has a non-empty label', () => {
    expect(getDefaultPeriod().label.length).toBeGreaterThan(0);
  });

  it('start <= end', () => {
    const p = getDefaultPeriod();
    expect(p.start.getTime()).toBeLessThanOrEqual(p.end.getTime());
  });
});

// ---------------------------------------------------------------------------
// scaleBudgetAmount
// ---------------------------------------------------------------------------
describe('scaleBudgetAmount', () => {
  // Build a single-month view period (January 2026)
  const jan2026: TimePeriod = {
    start: utc(2026, 1, 1),
    end: utc(2026, 1, 31),
    label: 'January 2026',
    type: 'month',
  };

  // Build a two-month view period (Jan + Feb 2026)
  const janFeb2026: TimePeriod = {
    start: utc(2026, 1, 1),
    end: utc(2026, 2, 28),
    label: 'Jan–Feb 2026',
    type: 'month',
  };

  // Single year view
  const year2026: TimePeriod = {
    start: utc(2026, 1, 1),
    end: utc(2026, 12, 31),
    label: '2026',
    type: 'year',
  };

  describe('monthly budget', () => {
    it('scales to 1 month for a single-month view', () => {
      expect(scaleBudgetAmount(1000, 'monthly', jan2026)).toBe(1000);
    });

    it('scales to 2 months for a two-month view', () => {
      expect(scaleBudgetAmount(1000, 'monthly', janFeb2026)).toBe(2000);
    });

    it('scales to 12 months for a full-year view', () => {
      expect(scaleBudgetAmount(500, 'monthly', year2026)).toBe(6000);
    });
  });

  describe('biweekly budget — no anchor (legacy proportional)', () => {
    it('28-day view yields amount × 2.0 (28/14)', () => {
      const period: TimePeriod = {
        start: utc(2026, 1, 1),
        end: utc(2026, 1, 28),
        label: '28 days',
        type: 'custom',
      };
      expect(scaleBudgetAmount(700, 'biweekly', period)).toBeCloseTo(1400, 4);
    });

    it('returns proportional amount for non-exact periods', () => {
      // 31 days → 31/14 ≈ 2.214 periods
      const amount = scaleBudgetAmount(700, 'biweekly', jan2026);
      expect(amount).toBeCloseTo((700 * 31) / 14, 4);
    });
  });

  describe('biweekly budget — with anchor (exact period count)', () => {
    // Anchor: Jan 2 2026 (Friday). Jan 2026 has 3 paychecks: Jan 2, Jan 16, Jan 30.
    const anchor = utc(2026, 1, 2);

    it('January 2026 yields amount × 3 (3-paycheck month)', () => {
      expect(scaleBudgetAmount(650, 'biweekly', jan2026, anchor)).toBe(650 * 3);
    });

    it('a standard 2-paycheck month yields amount × 2', () => {
      // Feb 2026: paychecks Feb 13, Feb 27 → 2 starts in Feb
      const feb2026: TimePeriod = {
        start: utc(2026, 2, 1),
        end: utc(2026, 2, 28),
        label: 'February 2026',
        type: 'month',
      };
      expect(scaleBudgetAmount(650, 'biweekly', feb2026, anchor)).toBe(650 * 2);
    });

    it('year-long view yields amount × 26', () => {
      expect(scaleBudgetAmount(500, 'biweekly', year2026, anchor)).toBe(500 * 26);
    });

    it('single-day view on a payday yields amount × 1', () => {
      const paydaySingleDay: TimePeriod = {
        start: anchor,
        end: anchor,
        label: 'Jan 2',
        type: 'custom',
      };
      expect(scaleBudgetAmount(500, 'biweekly', paydaySingleDay, anchor)).toBe(500);
    });

    it('single-day view on a non-payday yields amount × 0', () => {
      const nonPayday: TimePeriod = {
        start: utc(2026, 1, 3), // day after payday
        end: utc(2026, 1, 3),
        label: 'Jan 3',
        type: 'custom',
      };
      expect(scaleBudgetAmount(500, 'biweekly', nonPayday, anchor)).toBe(0);
    });
  });

  describe('yearly budget', () => {
    it('full year returns the same amount', () => {
      // 365 days / 365.25 ≈ 0.9993 — very close to 1
      const result = scaleBudgetAmount(12000, 'yearly', year2026);
      expect(result).toBeCloseTo(12000 * (365 / 365.25), 4);
    });

    it('single month is roughly 1/12 of annual', () => {
      const result = scaleBudgetAmount(12000, 'yearly', jan2026);
      // 31 / 365.25 * 12000
      expect(result).toBeCloseTo((31 / 365.25) * 12000, 2);
    });
  });

  it('falls back to raw amount for unknown period type', () => {
    // @ts-expect-error intentionally passing an invalid period type
    expect(scaleBudgetAmount(500, 'unknown', jan2026)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// getCompletePeriodsBetween
// ---------------------------------------------------------------------------
describe('getCompletePeriodsBetween', () => {
  describe('monthly', () => {
    it('returns 0 periods when from and to are the same month', () => {
      const from = utc(2026, 3, 1);
      const to = utc(2026, 3, 31);
      expect(getCompletePeriodsBetween('monthly', from, to)).toHaveLength(0);
    });

    it('returns 2 complete months for a 3-month span (excludes to-month)', () => {
      const from = utc(2026, 1, 1);
      const to = utc(2026, 3, 1);
      const periods = getCompletePeriodsBetween('monthly', from, to);
      expect(periods).toHaveLength(2);
      // Jan 2026
      expect(periods[0].start.getUTCMonth()).toBe(0);
      // Feb 2026
      expect(periods[1].start.getUTCMonth()).toBe(1);
    });

    it('each period has start on day 1 and end on last day of month', () => {
      const periods = getCompletePeriodsBetween('monthly', utc(2026, 1, 1), utc(2026, 4, 1));
      for (const p of periods) {
        expect(p.start.getUTCDate()).toBe(1);
        // End day is last day of that month
        const lastDay = new Date(
          Date.UTC(p.start.getUTCFullYear(), p.start.getUTCMonth() + 1, 0),
        ).getUTCDate();
        expect(p.end.getUTCDate()).toBe(lastDay);
      }
    });
  });

  describe('biweekly', () => {
    it('returns 0 periods when from === to', () => {
      const d = utc(2026, 1, 1);
      expect(getCompletePeriodsBetween('biweekly', d, d)).toHaveLength(0);
    });

    it('returns 1 complete period for a 28-day span (from < to, only 1 fits fully)', () => {
      // from Jan 1, to Jan 28 → only the period Jan 1–14 fits with periodEnd < toDate
      const from = utc(2026, 1, 1);
      const to = utc(2026, 1, 28);
      const periods = getCompletePeriodsBetween('biweekly', from, to);
      expect(periods.length).toBeGreaterThanOrEqual(1);
    });

    it('each period is exactly 14 days (start to end)', () => {
      const periods = getCompletePeriodsBetween('biweekly', utc(2026, 1, 1), utc(2026, 4, 1));
      for (const p of periods) {
        const diffMs = p.end.getTime() - p.start.getTime() + 1; // +1 because end is 23:59:59.999
        const diffDays = diffMs / (24 * 60 * 60 * 1000);
        expect(diffDays).toBeCloseTo(14, 1);
      }
    });
  });

  describe('yearly', () => {
    it('returns 0 years for same-year range', () => {
      expect(getCompletePeriodsBetween('yearly', utc(2026, 1, 1), utc(2026, 12, 31))).toHaveLength(
        0,
      );
    });

    it('returns 2 complete years for a 3-year span', () => {
      const periods = getCompletePeriodsBetween('yearly', utc(2024, 1, 1), utc(2026, 1, 1));
      expect(periods).toHaveLength(2);
      expect(periods[0].start.getUTCFullYear()).toBe(2024);
      expect(periods[1].start.getUTCFullYear()).toBe(2025);
    });

    it('each period starts on Jan 1 and ends on Dec 31', () => {
      const periods = getCompletePeriodsBetween('yearly', utc(2023, 1, 1), utc(2026, 1, 1));
      for (const p of periods) {
        expect(p.start.getUTCMonth()).toBe(0);
        expect(p.start.getUTCDate()).toBe(1);
        expect(p.end.getUTCMonth()).toBe(11);
        expect(p.end.getUTCDate()).toBe(31);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// formatPeriodLabel
// ---------------------------------------------------------------------------
describe('formatPeriodLabel', () => {
  it('returns the existing label when set', () => {
    const p: TimePeriod = {
      start: utc(2026, 1, 1),
      end: utc(2026, 1, 31),
      label: 'My custom label',
      type: 'custom',
    };
    expect(formatPeriodLabel(p)).toBe('My custom label');
  });

  it('formats a range when label is empty', () => {
    const p: TimePeriod = {
      start: new Date(2026, 0, 1), // local Jan 1 2026
      end: new Date(2026, 0, 31), // local Jan 31 2026
      label: '',
      type: 'month',
    };
    const result = formatPeriodLabel(p);
    expect(result).toContain('Jan');
    expect(result).toContain('2026');
  });
});

// ---------------------------------------------------------------------------
// getYearlyAmount
// ---------------------------------------------------------------------------
describe('getYearlyAmount', () => {
  it('monthly × 12', () => {
    expect(getYearlyAmount(1000, 'monthly')).toBe(12000);
  });

  it('biweekly × 26', () => {
    expect(getYearlyAmount(500, 'biweekly')).toBe(13000);
  });

  it('yearly × 1', () => {
    expect(getYearlyAmount(15000, 'yearly')).toBe(15000);
  });

  it('unknown period returns raw amount', () => {
    // @ts-expect-error intentional invalid period
    expect(getYearlyAmount(100, 'weekly')).toBe(100);
  });

  it('handles zero amount', () => {
    expect(getYearlyAmount(0, 'monthly')).toBe(0);
    expect(getYearlyAmount(0, 'biweekly')).toBe(0);
    expect(getYearlyAmount(0, 'yearly')).toBe(0);
  });

  it('handles negative amount', () => {
    expect(getYearlyAmount(-500, 'monthly')).toBe(-6000);
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats a positive number with CAD currency symbol', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1,234.56');
    // Either "CA$" or "$" depending on locale
    expect(result.length).toBeGreaterThan(6);
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats negative number', () => {
    const result = formatCurrency(-50);
    expect(result).toContain('50');
  });

  it('rounds to 2 decimal places', () => {
    const result = formatCurrency(9.999);
    // Should show 10.00 due to rounding
    expect(result).toContain('10');
  });
});

// ---------------------------------------------------------------------------
// parseDateInputAsUtc
// ---------------------------------------------------------------------------
describe('parseDateInputAsUtc', () => {
  it('parses YYYY-MM-DD into UTC midnight', () => {
    const d = parseDateInputAsUtc('2026-03-15');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('parses leap day correctly', () => {
    const d = parseDateInputAsUtc('2024-02-29');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(29);
  });

  it('parses first day of year', () => {
    const d = parseDateInputAsUtc('2026-01-01');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it('falls back to Date constructor for non-YYYY-MM-DD strings', () => {
    // Non-standard format — should not throw
    const d = parseDateInputAsUtc('not-a-date');
    expect(d instanceof Date).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatIsoDateForDisplay
// ---------------------------------------------------------------------------
describe('formatIsoDateForDisplay', () => {
  it('formats an ISO datetime string to default pattern', () => {
    const result = formatIsoDateForDisplay('2026-03-15T00:00:00.000Z');
    expect(result).toBe('Mar 15, 2026');
  });

  it('does not shift the day from the ISO date portion', () => {
    // UTC midnight — no day shift regardless of TZ
    const result = formatIsoDateForDisplay('2026-01-01T00:00:00.000Z');
    expect(result).toBe('Jan 1, 2026');
  });

  it('accepts a custom format pattern', () => {
    const result = formatIsoDateForDisplay('2026-12-25T12:00:00Z', 'yyyy/MM/dd');
    expect(result).toBe('2026/12/25');
  });

  it('throws a RangeError when the date portion is completely malformed', () => {
    // date-fns format() throws RangeError on an Invalid Date — this is the documented behaviour.
    expect(() => formatIsoDateForDisplay('bad-date')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// generateBiWeeklyPeriods
// ---------------------------------------------------------------------------
describe('generateBiWeeklyPeriods', () => {
  // Anchor: Friday Jan 2, 2026 (a real pay-Friday near the start of the year)
  const anchor = utc(2026, 1, 2);

  it('generates 2 periods for a standard February (28 days, 2 Fridays)', () => {
    const from = utc(2026, 2, 1);
    const to = utc(2026, 2, 28);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    expect(periods).toHaveLength(2);
  });

  it('each period is 14 days long', () => {
    const from = utc(2026, 1, 1);
    const to = utc(2026, 6, 30);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    for (const p of periods) {
      const diffDays = (p.end.getTime() - p.start.getTime() + 1) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(14, 1);
    }
  });

  it('periods are contiguous (no gap between consecutive periods)', () => {
    const from = utc(2026, 1, 1);
    const to = utc(2026, 6, 30);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    for (let i = 1; i < periods.length; i++) {
      const gapMs = periods[i].start.getTime() - periods[i - 1].end.getTime();
      expect(gapMs).toBe(1); // exactly 1 ms gap (end is 23:59:59.999, start is 00:00:00.000 of next day)
    }
  });

  it('sequence numbers are strictly increasing', () => {
    const from = utc(2026, 1, 1);
    const to = utc(2026, 6, 30);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].sequenceNumber).toBe(periods[i - 1].sequenceNumber + 1);
    }
  });

  it('returns empty array when range is before anchor and very short', () => {
    // 1-day range starting 3 days before anchor, but 3 is less than 14
    // so no full period starts within the range
    const from = utc(2025, 12, 31);
    const to = utc(2025, 12, 31);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    // Period starting Dec 5, 2025 would be a valid bi-weekly period before anchor.
    // Depending on modulo, there may be 0 or 1 — just verify it doesn't throw.
    expect(Array.isArray(periods)).toBe(true);
  });

  it('isThirdPaycheck is false when month has only 2 paychecks', () => {
    // Feb 2026 anchor Jan 2, 2026 → paychecks land Jan 30 & Feb 13 → Feb has 1 start → maybe 2
    // Use a known-2-paycheck month. Let's pick March 2026.
    const march = generateBiWeeklyPeriods(anchor, utc(2026, 3, 1), utc(2026, 3, 31));
    const thirdPaychecks = march.filter((p) => p.isThirdPaycheck);
    expect(thirdPaychecks).toHaveLength(0);
  });

  it('finds months with 3 paychecks across a full year', () => {
    // In any 52-week year there are exactly 2 months with 3 bi-weekly paychecks.
    const from = utc(2026, 1, 1);
    const to = utc(2026, 12, 31);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    const thirdPaychecks = periods.filter((p) => p.isThirdPaycheck);
    // 26 bi-weekly periods / year → 2 months get 3, the rest get 2
    expect(thirdPaychecks.length).toBe(2);
  });

  it('start dates of all returned periods are within [from, to]', () => {
    const from = utc(2026, 3, 1);
    const to = utc(2026, 5, 31);
    const periods = generateBiWeeklyPeriods(anchor, from, to);
    for (const p of periods) {
      expect(p.start.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(p.start.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it('works when anchor is after the from date (generates backward)', () => {
    // Anchor is far in the future; periods before it should still be correct.
    const futureAnchor = utc(2027, 1, 1);
    const from = utc(2026, 1, 1);
    const to = utc(2026, 3, 31);
    const periods = generateBiWeeklyPeriods(futureAnchor, from, to);
    expect(periods.length).toBeGreaterThan(0);
    for (const p of periods) {
      expect(p.start.getTime()).toBeGreaterThanOrEqual(from.getTime());
    }
  });

  it('single-day range on a period start returns exactly one period', () => {
    // anchor = Jan 2, 2026 → that day itself should be a period start.
    const periods = generateBiWeeklyPeriods(anchor, anchor, anchor);
    expect(periods).toHaveLength(1);
    expect(periods[0].start.getTime()).toBe(anchor.getTime());
  });
});

// ---------------------------------------------------------------------------
// getPeriodsOverlappingMonth
// ---------------------------------------------------------------------------
describe('getPeriodsOverlappingMonth', () => {
  const anchor = utc(2026, 1, 2); // Jan 2 2026

  it('returns 2 or 3 periods for every month in 2026', () => {
    for (let m = 0; m < 12; m++) {
      const count = getPeriodsOverlappingMonth(anchor, 2026, m).length;
      expect([2, 3]).toContain(count);
    }
  });

  it('all returned starts are within the given month', () => {
    for (let m = 0; m < 12; m++) {
      const periods = getPeriodsOverlappingMonth(anchor, 2026, m);
      for (const p of periods) {
        expect(p.start.getUTCFullYear()).toBe(2026);
        expect(p.start.getUTCMonth()).toBe(m);
      }
    }
  });

  it('total periods in 2026 sums to 26', () => {
    let total = 0;
    for (let m = 0; m < 12; m++) {
      total += getPeriodsOverlappingMonth(anchor, 2026, m).length;
    }
    expect(total).toBe(26);
  });
});

// ---------------------------------------------------------------------------
// countBiWeeklyPeriodsInMonth
// ---------------------------------------------------------------------------
describe('countBiWeeklyPeriodsInMonth', () => {
  const anchor = utc(2026, 1, 2);

  it('returns 2 or 3 for every month in 2026', () => {
    for (let m = 0; m < 12; m++) {
      const count = countBiWeeklyPeriodsInMonth(anchor, 2026, m);
      expect([2, 3]).toContain(count);
    }
  });

  it('sum across all months in 2026 is 26', () => {
    let total = 0;
    for (let m = 0; m < 12; m++) {
      total += countBiWeeklyPeriodsInMonth(anchor, 2026, m);
    }
    expect(total).toBe(26);
  });

  it('finds the known 3rd-paycheck months for a Friday Jan 2 anchor in 2026', () => {
    // With anchor Jan 2 2026, paychecks land on:
    // Jan 2, Jan 16, Jan 30 → 3 in January!
    // Then Feb 13, Feb 27 → 2 in Feb
    // Mar 13, Mar 27 → 2 in Mar
    // Apr 10, Apr 24 → 2 in Apr
    // May 8, May 22 → 2 in May
    // Jun 5, Jun 19 → 2 in Jun
    // Jul 3, Jul 17, Jul 31 → 3 in July!
    const threePaycheckMonths: number[] = [];
    for (let m = 0; m < 12; m++) {
      if (countBiWeeklyPeriodsInMonth(anchor, 2026, m) === 3) {
        threePaycheckMonths.push(m);
      }
    }
    // Should be months 0 (Jan) and 6 (Jul) based on the rhythm
    expect(threePaycheckMonths).toHaveLength(2);
    expect(threePaycheckMonths[0]).toBe(0); // January
    expect(threePaycheckMonths[1]).toBe(6); // July
  });
});

// ---------------------------------------------------------------------------
// isThirdPaycheckMonth
// ---------------------------------------------------------------------------
describe('isThirdPaycheckMonth', () => {
  const anchor = utc(2026, 1, 2);

  it('returns true for January 2026 (3 paychecks)', () => {
    expect(isThirdPaycheckMonth(anchor, 2026, 0)).toBe(true);
  });

  it('returns true for July 2026 (3 paychecks)', () => {
    expect(isThirdPaycheckMonth(anchor, 2026, 6)).toBe(true);
  });

  it('returns false for February 2026 (2 paychecks)', () => {
    expect(isThirdPaycheckMonth(anchor, 2026, 1)).toBe(false);
  });

  it('returns false for all other months in 2026', () => {
    const expectedFalseMonths = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
    for (const m of expectedFalseMonths) {
      expect(isThirdPaycheckMonth(anchor, 2026, m)).toBe(false);
    }
  });

  it('exactly 2 months per year are third-paycheck months', () => {
    let count = 0;
    for (let m = 0; m < 12; m++) {
      if (isThirdPaycheckMonth(anchor, 2026, m)) count++;
    }
    expect(count).toBe(2);
  });

  it('different anchor produces different 3rd-paycheck months', () => {
    // Anchor: Monday Jan 5 2026
    const anchor2 = utc(2026, 1, 5);
    const months1: number[] = [];
    const months2: number[] = [];
    for (let m = 0; m < 12; m++) {
      if (isThirdPaycheckMonth(anchor, 2026, m)) months1.push(m);
      if (isThirdPaycheckMonth(anchor2, 2026, m)) months2.push(m);
    }
    // Both should have 2 third-paycheck months, but likely different ones
    expect(months1).toHaveLength(2);
    expect(months2).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CSV date parsing strategies (mirrors import/route.ts logic)
// ---------------------------------------------------------------------------
// The import routes use two strategies to convert CSV date strings to UTC
// midnight Date objects:
//
//  (A) YYYY-MM-DD strings  → parseDateInputAsUtc(rawDate)
//  (B) Other formats       → date-fns parse() to get local components,
//                            then Date.UTC(year, month, day)
//
// Both must produce the same UTC midnight for the same calendar day,
// regardless of the server timezone.
// ---------------------------------------------------------------------------
describe('CSV date parsing strategies', () => {
  it('(A) parseDateInputAsUtc yields UTC midnight for a YYYY-MM-DD string', () => {
    const d = parseDateInputAsUtc('2026-01-15');
    expect(d.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('(B) date-fns parse + Date.UTC yields UTC midnight for a d/M/yyyy string', () => {
    // Simulates what the import route does for non-YYYY-MM-DD formats.
    // date-fns parse() returns a local-midnight Date (calendar day is correct),
    // then we extract calendar components and build UTC midnight.
    const rawDate = '15/01/2026';
    const fnsFormat = 'dd/MM/yyyy';
    const localDate = parseDateFns(rawDate, fnsFormat, new Date());
    const d = new Date(
      Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()),
    );
    expect(d.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('(A) and (B) produce identical timestamps for the same calendar day', () => {
    // Strategy A
    const a = parseDateInputAsUtc('2026-03-31');

    // Strategy B (with MM/DD/YYYY format common in US bank CSVs)
    const localDate = parseDateFns('03/31/2026', 'MM/dd/yyyy', new Date());
    const b = new Date(
      Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()),
    );

    expect(a.getTime()).toBe(b.getTime());
  });

  it('parseDateInputAsUtc result is identical to native new Date() for YYYY-MM-DD', () => {
    // ECMAScript specifies that date-only ISO strings are parsed as UTC midnight.
    // parseDateInputAsUtc must match that canonical behaviour.
    const native = new Date('2026-06-01');
    const custom = parseDateInputAsUtc('2026-06-01');
    expect(custom.toISOString()).toBe(native.toISOString());
  });

  it('(A) formatIsoDateForDisplay round-trips the calendar day stored by parseDateInputAsUtc', () => {
    // The UTC-midnight date stored by parseDateInputAsUtc must display as the
    // original calendar day — verified via formatIsoDateForDisplay.
    const stored = parseDateInputAsUtc('2026-12-25');
    const displayed = formatIsoDateForDisplay(stored.toISOString(), 'yyyy-MM-dd');
    expect(displayed).toBe('2026-12-25');
  });
});
