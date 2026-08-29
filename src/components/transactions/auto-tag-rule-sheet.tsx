'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagBadge } from '@/components/tags/tag-badge';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import type { TransactionWithTags } from '@/types';
import { MAX_REGEX_PATTERN_LENGTH } from '@/lib/regex-limits';
import type { TagOptionWithLevel } from './constants';

type MatchType = 'exact' | 'regex';

type PreviewTransaction = {
  id: string;
  date: string;
  name: string;
  debit: number;
  credit: number;
  tags: { id: string; name: string; color: string; isSource: boolean }[];
};

type PreviewResponse = {
  tagged: PreviewTransaction[];
  taggedTotal: number;
  untagged: PreviewTransaction[];
  untaggedTotal: number;
};

interface AutoTagRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithTags;
  availableTags: TagOptionWithLevel[];
  onRuleCreated: (applied: boolean) => void;
}

export function AutoTagRuleSheet({
  open,
  onOpenChange,
  transaction,
  availableTags,
  onRuleCreated,
}: AutoTagRuleSheetProps) {
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('regex');
  const [tagId, setTagId] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const testValue = useMemo(() => {
    return transaction.normalizedName ?? '';
  }, [transaction]);

  const regexError = useMemo(() => {
    if (!pattern.trim()) return '';
    if (matchType === 'regex') {
      return pattern.length <= MAX_REGEX_PATTERN_LENGTH
        ? ''
        : `Pattern cannot exceed ${MAX_REGEX_PATTERN_LENGTH} characters`;
    }

    return '';
  }, [pattern, matchType]);

  const testResult = useMemo(() => {
    if (!pattern.trim() || regexError) return null;
    try {
      if (matchType === 'exact') {
        return {
          matched: testValue.toLowerCase() === pattern.toLowerCase(),
          matchText: testValue,
        };
      }

      // Regex execution is intentionally server-only so an entered pattern can never
      // block the browser's main thread. The debounced preview below supplies results.
      return null;
    } catch {
      return null;
    }
  }, [pattern, regexError, testValue, matchType]);

  useEffect(() => {
    const trimmed = pattern.trim();
    if (!trimmed || regexError) {
      return;
    }

    const abortController = new AbortController();
    let active = true;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/auto-tag/rules/preview', {
          signal: abortController.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern: trimmed,
            matchType,
          }),
        });

        if (!active) {
          return;
        }

        if (!res.ok) {
          setPreview(null);
          return;
        }

        const data: PreviewResponse = await res.json();
        if (active) {
          setPreview(data);
        }
      } catch {
        if (active) {
          setPreview(null);
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
      abortController.abort();
      // Reset loading state so it never stays stuck when the fetch is aborted mid-flight
      // (the finally block is guarded by `active`, so it won't run after abort)
      setPreviewLoading(false);
    };
  }, [pattern, regexError, matchType]);

  const selectedTag = availableTags.find((t) => t.id === tagId);

  const handleSave = async (applyNow: boolean) => {
    if (!pattern.trim() || !tagId || regexError) return;
    setSaving(true);
    try {
      const res = await fetch('/api/auto-tag/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: pattern.trim(),
          matchType,
          tagId,
          applyNow,
        }),
      });
      if (!res.ok) return;
      onOpenChange(false);
      setPattern('');
      setMatchType('regex');
      setTagId('');
      setPreview(null);
      onRuleCreated(applyNow);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Create auto-tag rule
          </SheetTitle>
          <SheetDescription>
            Test regex against this transaction before saving the rule.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1">
            <Label>Match type</Label>
            <Select
              value={matchType}
              onValueChange={(v) => setMatchType((v as MatchType) ?? 'regex')}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    value === 'exact'
                      ? 'Exact match'
                      : value === 'regex'
                        ? 'Regex match'
                        : 'Regex match'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact match</SelectItem>
                <SelectItem value="regex">Regex match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pattern">Pattern</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={matchType === 'exact' ? 'e.g. uber eats' : 'e.g. uber\\s*eats'}
              className={regexError ? 'border-destructive' : ''}
            />
            {regexError && <p className="text-destructive text-xs">{regexError}</p>}
          </div>

          <div className="space-y-1">
            <Label>Apply tag</Label>
            <TagSelectorDropdown
              mode="single"
              tags={availableTags}
              value={tagId}
              onValueChange={(v) => setTagId(v)}
              placeholder="Select a tag…"
            />
            {selectedTag && (
              <p className="text-muted-foreground text-xs">Selected: {selectedTag.name}</p>
            )}
          </div>

          <div className="bg-muted rounded-md p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs">Transaction test value</p>
            <p className="font-mono wrap-break-word">{testValue || '—'}</p>
            <div className="mt-2 text-xs">
              {testResult?.matched ? (
                <span className="text-green-600">
                  Matched ({matchType}): &quot;{testResult.matchText}&quot;
                </span>
              ) : pattern.trim() && !regexError ? (
                <span className="text-muted-foreground">No match</span>
              ) : (
                <span className="text-muted-foreground">Enter a pattern to test</span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="text-muted-foreground text-xs">Matching transactions preview</p>
            {previewLoading ? (
              <p className="text-muted-foreground text-xs">Loading matches…</p>
            ) : !pattern.trim() || regexError ? (
              <p className="text-muted-foreground text-xs">
                Enter a valid pattern to preview matches.
              </p>
            ) : !preview ? (
              <p className="text-muted-foreground text-xs">No preview available.</p>
            ) : (
              <TooltipProvider>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium">
                      {preview.taggedTotal > preview.tagged.length
                        ? `Tagged (showing ${preview.tagged.length} of ${preview.taggedTotal})`
                        : `Tagged (${preview.taggedTotal})`}
                    </p>
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {preview.taggedTotal === 0 ? (
                        <p className="text-muted-foreground text-xs">No tagged matches</p>
                      ) : (
                        preview.tagged.map((tx) => (
                          <div key={tx.id} className="rounded border p-1.5">
                            <Tooltip>
                              <TooltipTrigger
                                render={<p className="truncate text-xs font-medium" />}
                              >
                                {tx.name}
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start">
                                {tx.name}
                              </TooltipContent>
                            </Tooltip>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tx.tags
                                .filter((t) => !t.isSource)
                                .map((t) => (
                                  <TagBadge
                                    key={t.id}
                                    name={t.name}
                                    color={t.color}
                                    className="text-[10px]"
                                  />
                                ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium">
                      {preview.untaggedTotal > preview.untagged.length
                        ? `Untagged (showing ${preview.untagged.length} of ${preview.untaggedTotal})`
                        : `Untagged (${preview.untaggedTotal})`}
                    </p>
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {preview.untaggedTotal === 0 ? (
                        <p className="text-muted-foreground text-xs">No untagged matches</p>
                      ) : (
                        preview.untagged.map((tx) => (
                          <div key={tx.id} className="rounded border p-1.5">
                            <Tooltip>
                              <TooltipTrigger
                                render={<p className="truncate text-xs font-medium" />}
                              >
                                {tx.name}
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start">
                                {tx.name}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave(false)}
            disabled={!pattern.trim() || !tagId || !!regexError || saving}
            variant="outline"
          >
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
          <Button
            onClick={() => void handleSave(true)}
            disabled={!pattern.trim() || !tagId || !!regexError || saving}
          >
            {saving ? 'Saving…' : 'Save and apply tags'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
