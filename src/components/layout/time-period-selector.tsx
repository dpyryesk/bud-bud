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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const PRESETS = [
  { key: 'current-month', label: 'Current Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'current-year', label: 'Current Year' },
  { key: 'last-year', label: 'Last Year' },
] as const;

export function TimePeriodSelector() {
  const { period, setPreset, setCustomRange } = useTimePeriod();
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePreset = (key: string) => {
    setPreset(key);
    setOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setCustomRange(new Date(customStart), new Date(customEnd));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
      >
        <CalendarDays className="h-4 w-4" />
        <span className="hidden sm:inline">{period.label}</span>
        <span className="sm:hidden">
          {format(period.start, 'MMM d')} - {format(period.end, 'MMM d')}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-2">
          <p className="text-sm font-medium">Select Period</p>
          <div className="grid gap-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant="ghost"
                className="justify-start"
                onClick={() => handlePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Custom Range</p>
            <div className="grid gap-2">
              <div>
                <Label htmlFor="custom-start" className="text-xs">
                  Start Date
                </Label>
                <Input
                  id="custom-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="custom-end" className="text-xs">
                  End Date
                </Label>
                <Input
                  id="custom-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
              <Button onClick={handleCustomApply} disabled={!customStart || !customEnd} size="sm">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
