'use client';

import { useState } from 'react';
import { Check, Search, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Minimum shape required for tags used in the selector.
 * All TagWithLevel variants (TagOptionWithLevel, LeveledTag) satisfy this.
 */
export type TagSelectorOption = {
  id: string;
  name: string;
  color: string;
  level: number;
};

type BaseProps = {
  tags: TagSelectorOption[];
  placeholder?: string;
  align?: 'start' | 'center' | 'end';
};

/**
 * Single-select mode: closes on selection, shows selected tag in default trigger.
 */
type SingleProps = BaseProps & {
  mode: 'single';
  value: string;
  onValueChange: (tagId: string) => void;
  /** Extra className applied to the default trigger button. */
  className?: string;
};

/**
 * Multi-select mode: stays open on selection, toggles individual tags.
 * Provide triggerLabel / triggerClassName / triggerAriaLabel to customise the
 * compact trigger (e.g. a "+" button). If omitted, a select-style trigger is
 * rendered showing the selection count.
 */
type MultiProps = BaseProps & {
  mode: 'multi';
  value: string[];
  onToggle: (tagId: string) => void;
  /** Content rendered inside the trigger button. Defaults to "+". */
  triggerLabel?: React.ReactNode;
  /** className for the trigger button. */
  triggerClassName?: string;
  /** aria-label for the trigger button. */
  triggerAriaLabel?: string;
};

export type TagSelectorDropdownProps = SingleProps | MultiProps;

/**
 * Shared tag-selector dropdown used across transactions, budget, and auto-tag
 * rules. Renders a 400 × 600 px popover with a search bar and a scrollable,
 * hierarchically-indented tag list.
 */
export function TagSelectorDropdown(props: TagSelectorDropdownProps) {
  const { tags, placeholder = 'Select a tag…', align = 'start' } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) setSearch('');
  };

  const filteredTags = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (tagId: string) => {
    if (props.mode === 'single') {
      props.onValueChange(tagId);
      setOpen(false);
    } else {
      props.onToggle(tagId);
    }
  };

  const isSelected = (tagId: string): boolean => {
    if (props.mode === 'single') return props.value === tagId;
    return props.value.includes(tagId);
  };

  /* ---- Trigger ---- */
  const renderTrigger = () => {
    if (props.mode === 'single') {
      const selectedTag = tags.find((t) => t.id === props.value);
      return (
        <PopoverTrigger
          className={cn(
            'border-input ring-offset-background focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            props.className,
          )}
        >
          {selectedTag ? (
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedTag.color }}
              />
              <span className="truncate">{selectedTag.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
      );
    }

    /* Multi mode */
    const { triggerLabel = '+', triggerClassName, triggerAriaLabel, value } = props as MultiProps;

    /* If a custom className is provided, render a compact button trigger */
    if (triggerClassName !== undefined) {
      return (
        <PopoverTrigger className={triggerClassName} aria-label={triggerAriaLabel}>
          {triggerLabel}
        </PopoverTrigger>
      );
    }

    /* Default multi trigger (select-style showing selection count) */
    const count = value.length;
    const firstTag = count > 0 ? tags.find((t) => t.id === value[0]) : null;
    return (
      <PopoverTrigger
        className={cn(
          'border-input ring-offset-background focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-label={triggerAriaLabel}
      >
        {count === 0 ? (
          <span className="text-muted-foreground truncate">{placeholder ?? 'Select tags…'}</span>
        ) : count === 1 && firstTag ? (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: firstTag.color }}
            />
            <span className="truncate">{firstTag.name}</span>
          </span>
        ) : (
          <span>{count} tags selected</span>
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
    );
  };

  /* ---- Render ---- */
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {renderTrigger()}
      <PopoverContent className="w-[400px] p-0" align={align} sideOffset={4}>
        <div className="flex flex-col" style={{ height: '600px' }}>
          {/* Search bar */}
          <div className="border-b p-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Tag list */}
          <div className="flex-1 overflow-y-auto p-1">
            {tags.length === 0 ? (
              <p className="text-muted-foreground p-2 text-center text-sm">
                No tags available. Create some in Tags.
              </p>
            ) : filteredTags.length === 0 ? (
              <p className="text-muted-foreground p-2 text-center text-sm">
                No tags match your search.
              </p>
            ) : (
              filteredTags.map((tag) => {
                const selected = isSelected(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={cn(
                      'hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                      selected && 'bg-muted',
                    )}
                    onClick={() => handleSelect(tag.id)}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{ paddingLeft: `${tag.level * 14}px` }}
                    >
                      {tag.name}
                    </span>
                    {selected && <Check className="ml-auto h-4 w-4 shrink-0 opacity-70" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
