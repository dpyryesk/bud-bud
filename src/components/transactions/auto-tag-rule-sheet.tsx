'use client';

import { useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionWithTags } from '@/types';
import type { TagOptionWithLevel } from './constants';

interface AutoTagRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithTags;
  availableTags: TagOptionWithLevel[];
  onRuleCreated: () => void;
}

export function AutoTagRuleSheet({
  open,
  onOpenChange,
  transaction,
  availableTags,
  onRuleCreated,
}: AutoTagRuleSheetProps) {
  const [pattern, setPattern] = useState('');
  const [tagId, setTagId] = useState('');
  const [saving, setSaving] = useState(false);

  const testValue = useMemo(() => {
    return transaction.normalizedName ?? '';
  }, [transaction]);

  const regexError = useMemo(() => {
    if (!pattern.trim()) return '';
    try {
      new RegExp(pattern, 'i');
      return '';
    } catch {
      return 'Invalid regex pattern';
    }
  }, [pattern]);

  const testResult = useMemo(() => {
    if (!pattern.trim() || regexError) return null;
    try {
      const regex = new RegExp(pattern, 'i');
      const match = regex.exec(testValue);
      if (!match) return { matched: false as const, matchText: '' };
      return { matched: true as const, matchText: match[0] ?? '' };
    } catch {
      return null;
    }
  }, [pattern, regexError, testValue]);

  const selectedTag = availableTags.find((t) => t.id === tagId);

  const handleSave = async () => {
    if (!pattern.trim() || !tagId || regexError) return;
    setSaving(true);
    try {
      const res = await fetch('/api/auto-tag/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: pattern.trim(),
          matchType: 'regex',
          tagId,
        }),
      });
      if (!res.ok) return;
      onOpenChange(false);
      setPattern('');
      setTagId('');
      onRuleCreated();
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
            <Label>Match field</Label>
            <Input value="Normalized name" disabled readOnly />
          </div>

          <div className="space-y-1">
            <Label htmlFor="regex-pattern">Regex pattern</Label>
            <Input
              id="regex-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. uber\\s*eats"
              className={regexError ? 'border-destructive' : ''}
            />
            {regexError && <p className="text-destructive text-xs">{regexError}</p>}
          </div>

          <div className="space-y-1">
            <Label>Apply tag</Label>
            <Select value={tagId} onValueChange={(v) => setTagId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    if (!value) return 'Select a tag…';
                    return availableTags.find((t) => t.id === value)?.name ?? 'Unknown tag';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <span style={{ marginLeft: `${tag.level * 14}px` }}>{tag.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTag && (
              <p className="text-muted-foreground text-xs">Selected: {selectedTag.name}</p>
            )}
          </div>

          <div className="bg-muted rounded-md p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs">Transaction test value</p>
            <p className="font-mono break-words">{testValue || '—'}</p>
            <div className="mt-2 text-xs">
              {testResult?.matched ? (
                <span className="text-green-600">Matched: &quot;{testResult.matchText}&quot;</span>
              ) : pattern.trim() && !regexError ? (
                <span className="text-muted-foreground">No match</span>
              ) : (
                <span className="text-muted-foreground">Enter a regex to test</span>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!pattern.trim() || !tagId || !!regexError || saving}
          >
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
