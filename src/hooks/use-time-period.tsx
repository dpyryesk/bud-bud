'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type TimePeriod, getDefaultPeriod, type PeriodType } from '@/lib/date-utils';
import {
  startOfMonth,
  endOfMonth,
  setMonth,
  setYear,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  format,
} from 'date-fns';

type TimePeriodContextType = {
  period: TimePeriod;
  setPeriod: (period: TimePeriod) => void;
  setPreset: (preset: string) => void;
  setCustomRange: (start: Date, end: Date) => void;
  setMonthYear: (month: number, year: number) => void;
};

const TimePeriodContext = createContext<TimePeriodContextType | null>(null);

export function TimePeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<TimePeriod>(getDefaultPeriod);

  const setPreset = useCallback((preset: string) => {
    const now = new Date();
    let newPeriod: TimePeriod;

    switch (preset) {
      case 'current-month':
        newPeriod = {
          start: startOfMonth(now),
          end: endOfMonth(now),
          label: format(now, 'MMMM yyyy'),
          type: 'month' as PeriodType,
        };
        break;
      case 'last-month': {
        const lastMonth = subMonths(now, 1);
        newPeriod = {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth),
          label: format(lastMonth, 'MMMM yyyy'),
          type: 'month' as PeriodType,
        };
        break;
      }
      case 'current-year':
        newPeriod = {
          start: startOfYear(now),
          end: endOfYear(now),
          label: format(now, 'yyyy'),
          type: 'year' as PeriodType,
        };
        break;
      case 'last-year': {
        const lastYear = subYears(now, 1);
        newPeriod = {
          start: startOfYear(lastYear),
          end: endOfYear(lastYear),
          label: format(lastYear, 'yyyy'),
          type: 'year' as PeriodType,
        };
        break;
      }
      default:
        return;
    }

    setPeriod(newPeriod);
  }, []);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setPeriod({
      start,
      end,
      label: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      type: 'custom' as PeriodType,
    });
  }, []);

  const setMonthYear = useCallback((month: number, year: number) => {
    const now = new Date();
    const withMonth = setMonth(now, month);
    const withYear = setYear(withMonth, year);

    setPeriod({
      start: startOfMonth(withYear),
      end: endOfMonth(withYear),
      label: format(withYear, 'MMMM yyyy'),
      type: 'month' as PeriodType,
    });
  }, []);

  return (
    <TimePeriodContext.Provider value={{ period, setPeriod, setPreset, setCustomRange, setMonthYear }}>
      {children}
    </TimePeriodContext.Provider>
  );
}

export function useTimePeriod() {
  const context = useContext(TimePeriodContext);
  if (!context) {
    throw new Error('useTimePeriod must be used within a TimePeriodProvider');
  }
  return context;
}
