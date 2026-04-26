'use client';

import { Step, STEP_LABELS, STEPS } from '@/components/import/constants';
import { Check, ChevronRight } from 'lucide-react';

export default function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`text-sm ${active ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
            >
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="text-muted-foreground h-4 w-4" />}
          </div>
        );
      })}
    </nav>
  );
}
