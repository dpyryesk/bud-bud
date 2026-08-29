'use client';

import { useCallback, useEffect, useState } from 'react';
import { AutoTagRule, LeveledTag } from '@/components/tags/constants';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Zap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TagBadge } from '@/components/tags/tag-badge';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import { Badge } from '@/components/ui/badge';
import { MAX_REGEX_PATTERN_LENGTH } from '@/lib/regex-limits';

export default function AutoTagRulesSection({ categoryTags }: { categoryTags: LeveledTag[] }) {
  const [rules, setRules] = useState<AutoTagRule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formPattern, setFormPattern] = useState('');
  const [formMatchType, setFormMatchType] = useState<'exact' | 'regex'>('exact');
  const [formTagId, setFormTagId] = useState('');
  const [saving, setSaving] = useState(false);
  const [regexError, setRegexError] = useState('');

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/auto-tag/rules');
    const data = await res.json();
    setRules(data);
  }, []);

  useEffect(() => {
    fetch('/api/auto-tag/rules')
      .then((res) => res.json())
      .then((data) => setRules(data));
  }, []);

  const resetForm = useCallback(() => {
    setFormPattern('');
    setFormMatchType('exact');
    setFormTagId('');
    setRegexError('');
  }, []);

  const validateRegex = useCallback(
    (pattern: string) => {
      if (formMatchType !== 'regex') {
        setRegexError('');
        return true;
      }
      const valid = pattern.length <= MAX_REGEX_PATTERN_LENGTH;
      setRegexError(valid ? '' : `Pattern cannot exceed ${MAX_REGEX_PATTERN_LENGTH} characters`);
      return valid;
    },
    [formMatchType],
  );

  const handlePatternChange = useCallback(
    (value: string) => {
      setFormPattern(value);
      if (formMatchType === 'regex') validateRegex(value);
    },
    [formMatchType, validateRegex],
  );

  const handleMatchTypeChange = useCallback(
    (value: 'exact' | 'regex') => {
      setFormMatchType(value);
      setRegexError('');
      if (value === 'regex' && formPattern) {
        validateRegex(formPattern);
      }
    },
    [formPattern, validateRegex],
  );

  const handleCreate = useCallback(async () => {
    if (!formPattern.trim() || !formTagId) return;
    if (!validateRegex(formPattern)) return;

    setSaving(true);
    try {
      const res = await fetch('/api/auto-tag/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: formPattern.trim(),
          matchType: formMatchType,
          tagId: formTagId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setRegexError(err.error ?? 'Failed to create rule');
        return;
      }

      setDialogOpen(false);
      resetForm();
      await fetchRules();
    } finally {
      setSaving(false);
    }
  }, [fetchRules, formMatchType, formPattern, formTagId, resetForm, validateRegex]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this auto-tag rule?')) return;
      await fetch(`/api/auto-tag/rules/${id}`, { method: 'DELETE' });
      fetchRules();
    },
    [fetchRules],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Zap className="text-muted-foreground h-4 w-4" />
        <h2 className="text-lg font-semibold">Auto-Tag Rules</h2>
        <span className="text-muted-foreground text-sm">({rules.length})</span>
        <div className="flex-1" />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button size="sm" onClick={() => setDialogOpen(true)} />}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Rule
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Auto-Tag Rule</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Match type */}
              <div className="space-y-1">
                <Label>Match Type</Label>
                <Select
                  value={formMatchType}
                  onValueChange={(v) => handleMatchTypeChange(v as 'exact' | 'regex')}
                >
                  <SelectTrigger>
                    <span className="text-sm capitalize">{formMatchType}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {formMatchType === 'exact'
                    ? 'Match transactions whose normalized name is exactly this text (case-insensitive).'
                    : 'Match transactions whose normalized name matches this regular expression.'}
                </p>
              </div>

              {/* Pattern */}
              <div className="space-y-1">
                <Label htmlFor="rule-pattern">Pattern</Label>
                <Input
                  id="rule-pattern"
                  value={formPattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  placeholder={formMatchType === 'exact' ? 'e.g. uber eats' : 'e.g. uber\\s*eats'}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                  className={regexError ? 'border-destructive' : ''}
                />
                {regexError && <p className="text-destructive text-xs">{regexError}</p>}
                {formMatchType === 'exact' && (
                  <p className="text-muted-foreground text-xs">
                    Tip: the pattern is matched against the normalized name, which is lowercase with
                    long numbers stripped.
                  </p>
                )}
              </div>

              {/* Tag */}
              <div className="space-y-1">
                <Label>Apply Tag</Label>
                <TagSelectorDropdown
                  mode="single"
                  tags={categoryTags}
                  value={formTagId}
                  onValueChange={(v) => setFormTagId(v)}
                  placeholder="Select a tag…"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formPattern.trim() || !formTagId || !!regexError || saving}
                >
                  {saving ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-muted-foreground mb-3 text-sm">
        Rules are applied when you run auto-tagging. Each rule matches the transaction&apos;s
        normalized name and applies the associated tag.
      </p>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No rules yet.{' '}
          <button className="underline" onClick={() => setDialogOpen(true)}>
            Create one
          </button>{' '}
          to automatically tag transactions by name pattern.
        </p>
      ) : (
        <div className="rounded-md border">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className={`group flex items-center gap-3 px-3 py-2.5 ${idx < rules.length - 1 ? 'border-b' : ''}`}
            >
              {/* Match type badge */}
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-xs tracking-wide uppercase"
              >
                {rule.matchType}
              </Badge>

              {/* Pattern */}
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-0.5 font-mono text-sm">
                {rule.pattern}
              </code>

              {/* Arrow */}
              <span className="text-muted-foreground shrink-0 text-xs">→</span>

              {/* Tag */}
              <div className="shrink-0">
                <TagBadge name={rule.tag.name} color={rule.tag.color} />
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                title="Delete rule"
                onClick={() => handleDelete(rule.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
