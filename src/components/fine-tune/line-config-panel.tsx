'use client';

import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagBadge } from '@/components/tags/tag-badge';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import type { FineTuneDraftConfig } from '@/types';
import type { BudgetPeriodType } from '@/lib/date-utils';
import type { TagWithLevel } from '@/lib/tag-tree';

type TagOption = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

interface LineConfigPanelProps {
  draft: FineTuneDraftConfig;
  allTags: TagWithLevel<TagOption>[];
  amountInput: string;
  avgPerMonth?: number;
  onAmountInputChange: (raw: string) => void;
  onPeriodChange: (period: BudgetPeriodType) => void;
  onRolloverChange: (rollover: boolean) => void;
  onTagAdd: (tagId: string) => void;
  onTagRemove: (tagId: string) => void;
}

export function LineConfigPanel({
  draft,
  allTags,
  amountInput,
  avgPerMonth,
  onAmountInputChange,
  onPeriodChange,
  onRolloverChange,
  onTagAdd,
  onTagRemove,
}: LineConfigPanelProps) {
  // Only show non-source category tags as selectable options
  const selectableTags = allTags.filter((t) => !t.isSource && !draft.tagIds.includes(t.id));
  const selectedTagObjects = draft.tagIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter(Boolean) as TagWithLevel<TagOption>[];

  const handleSuggestedClick = () => {
    if (avgPerMonth == null) return;
    const yearlyAvg = avgPerMonth * 12;
    let suggested: number;
    if (draft.period === 'monthly') {
      suggested = Math.round(avgPerMonth);
    } else if (draft.period === 'biweekly') {
      suggested = Math.round(yearlyAvg / 26);
    } else {
      // yearly
      suggested = Math.round(yearlyAvg);
    }
    onAmountInputChange(String(suggested));
  };

  const handleTagSelect = (tagId: string) => {
    if (tagId && !draft.tagIds.includes(tagId)) {
      onTagAdd(tagId);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Adjust Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount & Period */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Amount ($)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="1"
                min="0"
                value={amountInput}
                onChange={(e) => onAmountInputChange(e.target.value)}
                placeholder="0.00"
                className="h-8 min-w-0 flex-1 text-sm"
              />
              {avgPerMonth != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={handleSuggestedClick}
                  title={`Set to historical monthly average (~$${Math.round(avgPerMonth)}) scaled to ${draft.period}`}
                >
                  Suggested
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <Select
              value={draft.period}
              onValueChange={(v) => {
                if (v) onPeriodChange(v as BudgetPeriodType);
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue>
                  {(value: string | null) =>
                    value === 'monthly'
                      ? 'Monthly'
                      : value === 'biweekly'
                        ? 'Biweekly'
                        : value === 'yearly'
                          ? 'Yearly'
                          : 'Select period'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rollover toggle */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Rollover unused budget</p>
            <p className="text-muted-foreground text-xs">
              Carry over unspent amounts to the next period
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.rollover}
            onClick={() => onRolloverChange(!draft.rollover)}
            className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              draft.rollover ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                draft.rollover ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Linked tags</Label>
            {selectableTags.length > 0 && (
              <TagSelectorDropdown
                mode="single"
                value=""
                onValueChange={handleTagSelect}
                tags={selectableTags}
                placeholder="Add tag…"
                className="h-7 text-xs"
              />
            )}
          </div>

          {selectedTagObjects.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-center text-xs">
              No tags linked — spending will show as $0
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedTagObjects.map((tag) => (
                <div key={tag.id} className="group flex items-center gap-1">
                  <TagBadge name={tag.name} color={tag.color} className="text-xs" />
                  <button
                    type="button"
                    onClick={() => onTagRemove(tag.id)}
                    className="text-muted-foreground hover:text-destructive hidden rounded-full group-hover:flex"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Changing tags will reload spending data from the server.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
