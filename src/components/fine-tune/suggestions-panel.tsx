'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Suggestion } from './constants';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
}

const SEVERITY_STYLES: Record<string, string> = {
  tip: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
  warning:
    'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
  info: 'border-muted bg-muted/50 text-muted-foreground',
};

export function SuggestionsPanel({ suggestions }: SuggestionsPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Insights & Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={cn(
              'flex gap-2.5 rounded-md border px-3 py-2 text-sm',
              SEVERITY_STYLES[s.severity],
            )}
          >
            <span className="mt-0.5 shrink-0 text-base leading-none">{s.icon}</span>
            <p className="leading-snug">{s.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
