'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { useTimePeriod } from '@/hooks/use-time-period';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MONTHS = [
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
] as const;

function buildYearOptions(selectedYear: number) {
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(currentYear - 5, selectedYear);
  const maxYear = Math.max(currentYear + 1, selectedYear);

  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(year);
  }
  return years;
}

function getMonthLabel(monthValue: string) {
  return MONTHS.find((month) => month.value === monthValue)?.label ?? monthValue;
}

export function TimePeriodSelector() {
  const { period, setMonthYear, setPreset } = useTimePeriod();
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(period.start.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(period.start.getFullYear()));

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedMonth(String(period.start.getMonth()));
      setSelectedYear(String(period.start.getFullYear()));
    }
    setOpen(nextOpen);
  };

  const handleApply = () => {
    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    setMonthYear(month, year);
    setOpen(false);
  };

  const handleCurrentMonth = () => {
    setPreset('current-month');
    setOpen(false);
  };

  const handleCurrentYear = () => {
    setPreset('current-year');
    setOpen(false);
  };

  const yearOptions = buildYearOptions(Number(selectedYear));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
      >
        <CalendarDays className="h-4 w-4" />
        <span>{period.label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={handleCurrentMonth}>
              Current Month
            </Button>
            <Button variant="outline" size="sm" onClick={handleCurrentYear}>
              Current Year
            </Button>
          </div>

          <p className="text-sm font-medium">Select Month and Year</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={selectedMonth} onValueChange={(v) => { if (v !== null) setSelectedMonth(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue>{getMonthLabel(selectedMonth)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={(v) => { if (v !== null) setSelectedYear(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleApply} size="sm" className="w-full">
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
