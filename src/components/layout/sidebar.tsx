'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Tags, Upload, PiggyBank, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { buildTagsInDisplayOrder, type TagWithLevel } from '@/lib/tag-tree';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/tags', label: 'Tags', icon: Tags },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/budget', label: 'Budget', icon: PiggyBank },
] as const;

type SimpleTag = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

type LeveledTag = TagWithLevel<SimpleTag>;

function NewAutoTagRuleButton() {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<LeveledTag[]>([]);
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<'exact' | 'regex'>('exact');
  const [tagId, setTagId] = useState('');
  const [regexError, setRegexError] = useState('');
  const [saving, setSaving] = useState(false);

  const openDialog = useCallback(async () => {
    setOpen(true);
    try {
      const res = await fetch('/api/tags');
      const data: SimpleTag[] = await res.json();
      const categoryTags = data.filter((tag) => !tag.isSource);
      setTags(buildTagsInDisplayOrder(categoryTags));
    } catch {
      // silently ignore; user will see empty tag list
    }
  }, []);

  const reset = useCallback(() => {
    setPattern('');
    setMatchType('exact');
    setTagId('');
    setRegexError('');
    setSaving(false);
  }, []);

  const handleMatchTypeChange = useCallback(
    (v: 'exact' | 'regex') => {
      setMatchType(v);
      if (v === 'exact') setRegexError('');
      else if (pattern.trim()) {
        try {
          new RegExp(pattern.trim());
          setRegexError('');
        } catch {
          setRegexError('Invalid regular expression');
        }
      }
    },
    [pattern],
  );

  const handlePatternChange = useCallback(
    (v: string) => {
      setPattern(v);
      if (matchType === 'regex' && v.trim()) {
        try {
          new RegExp(v.trim());
          setRegexError('');
        } catch {
          setRegexError('Invalid regular expression');
        }
      } else {
        setRegexError('');
      }
    },
    [matchType],
  );

  const handleCreate = useCallback(async () => {
    if (!pattern.trim() || !tagId || regexError) return;
    setSaving(true);
    try {
      const res = await fetch('/api/auto-tag/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern.trim(), matchType, tagId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setRegexError(err.error ?? 'Failed to create rule');
        return;
      }
      setOpen(false);
      reset();
    } finally {
      setSaving(false);
    }
  }, [matchType, pattern, regexError, reset, tagId]);

  const selectedTag = tags.find((t) => t.id === tagId);

  return (
    <>
      <button
        onClick={openDialog}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Plus className="h-4 w-4" />
        New Auto-Tag Rule
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Auto-Tag Rule</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Match type */}
            <div className="space-y-1">
              <Label>Match Type</Label>
              <Select
                value={matchType}
                onValueChange={(v) => handleMatchTypeChange(v as 'exact' | 'regex')}
              >
                <SelectTrigger>
                  <span className="text-sm capitalize">{matchType}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {matchType === 'exact'
                  ? 'Match transactions whose normalized name is exactly this text (case-insensitive).'
                  : 'Match transactions whose normalized name matches this regular expression.'}
              </p>
            </div>

            {/* Pattern */}
            <div className="space-y-1">
              <Label htmlFor="sidebar-rule-pattern">Pattern</Label>
              <Input
                id="sidebar-rule-pattern"
                value={pattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                placeholder={matchType === 'exact' ? 'e.g. uber eats' : 'e.g. uber\\s*eats'}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                className={regexError ? 'border-destructive' : ''}
              />
              {regexError && <p className="text-destructive text-xs">{regexError}</p>}
              {matchType === 'exact' && (
                <p className="text-muted-foreground text-xs">
                  Tip: matched against the normalized name — lowercase with long numbers stripped.
                </p>
              )}
            </div>

            {/* Tag */}
            <div className="space-y-1">
              <Label>Apply Tag</Label>
              <Select value={tagId} onValueChange={(v) => setTagId(v ?? '')}>
                <SelectTrigger>
                  {selectedTag ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      <span
                        className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                        style={{ backgroundColor: selectedTag.color }}
                      />
                      {selectedTag.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Select a tag…</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {tags.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1.5 text-xs">No tags yet</div>
                  ) : (
                    tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        <span style={{ marginLeft: `${t.level * 14}px` }}>{t.name}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!pattern.trim() || !tagId || !!regexError || saving}
              >
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-muted/40 hidden w-56 border-r md:block">
      <nav className="flex flex-col gap-1 p-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="my-1 border-t" />
        <NewAutoTagRuleButton />
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background fixed right-0 bottom-0 left-0 z-50 border-t md:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
