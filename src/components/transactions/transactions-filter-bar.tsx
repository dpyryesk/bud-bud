'use client';

import { Search, FilterX, Wand2, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import type { TagOptionWithLevel } from './constants';

export type TransactionsFilterBarProps = {
  availableTags: TagOptionWithLevel[];
  /** Text search value (controlled by parent; debouncing is parent's responsibility) */
  search: string;
  untaggedOnly: boolean;
  /** IDs of tags currently selected in the tag filter */
  filterTagIds: string[];
  /** Raw string from the min-amount input (empty string = no filter) */
  minAmount: string;
  /** Raw string from the max-amount input (empty string = no filter) */
  maxAmount: string;
  onSearchChange: (value: string) => void;
  onUntaggedOnlyToggle: () => void;
  /** Toggle a single tag in/out of filterTagIds */
  onFilterTagToggle: (tagId: string) => void;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  /** Clears filterTagIds + minAmount + maxAmount (not search or untaggedOnly) */
  onClearAdvancedFilters: () => void;
  onAutoTag: () => void;
  total: number;
  loading: boolean;
  /**
   * When true the tag-filter and amount-range rows are hidden.
   * Use when the table is embedded in a context that already applies a tag
   * filter via extraParams (e.g. the budget tag-transactions panel).
   */
  hideAdvancedFilters?: boolean;
};

export function TransactionsFilterBar({
  availableTags,
  search,
  untaggedOnly,
  filterTagIds,
  minAmount,
  maxAmount,
  onSearchChange,
  onUntaggedOnlyToggle,
  onFilterTagToggle,
  onMinAmountChange,
  onMaxAmountChange,
  onClearAdvancedFilters,
  onAutoTag,
  total,
  loading,
  hideAdvancedFilters = false,
}: TransactionsFilterBarProps) {
  const advancedActive = filterTagIds.length > 0 || minAmount !== '' || maxAmount !== '';

  return (
    <div className="space-y-2">
      {/* Row 1: text search + quick filters + actions */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={untaggedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={onUntaggedOnlyToggle}
          title={untaggedOnly ? 'Showing untagged only — click to clear' : 'Show untagged only'}
        >
          <FilterX className="mr-1.5 h-3.5 w-3.5" />
          Untagged only
        </Button>
        <Button onClick={onAutoTag} variant="outline" size="sm">
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Auto-Tag
        </Button>
        <span className="text-muted-foreground ml-auto text-sm">
          {loading ? 'Loading…' : `${total} transaction${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Row 2: tag filter + amount range (hidden in embedded/compact contexts) */}
      {!hideAdvancedFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Tag multi-select */}
          <div className="flex items-center gap-1.5">
            <Tag className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <div className="w-56">
              <TagSelectorDropdown
                mode="multi"
                tags={availableTags}
                value={filterTagIds}
                onToggle={onFilterTagToggle}
                placeholder="Filter by tags…"
              />
            </div>
          </div>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => onMinAmountChange(e.target.value)}
              className="w-24"
              min={0}
              step={0.01}
            />
            <span className="text-muted-foreground text-sm">–</span>
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => onMaxAmountChange(e.target.value)}
              className="w-24"
              min={0}
              step={0.01}
            />
          </div>

          {/* Clear advanced filters button */}
          {advancedActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAdvancedFilters}
              className="h-8 px-2 text-xs"
            >
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
