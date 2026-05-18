'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const CHECKLIST_KEY = 'sidebar-checklist-collapsed';
const WARNINGS_KEY = 'sidebar-warnings-collapsed';

interface AppHealthData {
  tagCount: number;
  hasBudget: boolean;
  budgetLineCount: number;
  incomeSourceCount: number;
  transactionCount: number;
  autoTagRuleCount: number;
  untaggedTransactionCount: number;
  uncategorizedTransactionCount: number;
  yearlyBudget: number;
  yearlyIncome: number;
  currentYear: number;
}

interface CheckItem {
  id: string;
  type: 'todo' | 'warning';
  label: string;
  completed: boolean;
  action?: () => void;
}

function buildTodoItems(
  data: AppHealthData,
  onNavigate: (href: string, preset?: string) => void,
): CheckItem[] {
  return [
    {
      id: 'tags',
      type: 'todo',
      label: 'Create transaction tags',
      completed: data.tagCount > 0,
      action: () => onNavigate('/tags'),
    },
    {
      id: 'budget',
      type: 'todo',
      label: 'Create a budget',
      completed: data.hasBudget,
      action: () => onNavigate('/budgets'),
    },
    {
      id: 'budget-lines',
      type: 'todo',
      label: 'Add budget lines',
      completed: data.budgetLineCount > 0,
      action: () => onNavigate('/budget'),
    },
    {
      id: 'income',
      type: 'todo',
      label: 'Add income sources',
      completed: data.incomeSourceCount > 0,
      action: () => onNavigate('/budget'),
    },
    {
      id: 'import',
      type: 'todo',
      label: 'Import transactions',
      completed: data.transactionCount > 0,
      action: () => onNavigate('/import'),
    },
    {
      id: 'auto-tag-rules',
      type: 'todo',
      label: 'Set up auto-tag rules',
      // Complete if rules exist, or if no transactions yet (not yet applicable)
      completed: data.autoTagRuleCount > 0 || data.transactionCount === 0,
      action: () => onNavigate('/tags#auto-tag-rules'),
    },
  ];
}

function buildWarningItems(
  data: AppHealthData,
  onNavigate: (href: string, preset?: string) => void,
): CheckItem[] {
  return [
    {
      id: 'untagged',
      type: 'warning',
      label:
        data.untaggedTransactionCount > 0
          ? `${data.untaggedTransactionCount} untagged transaction${data.untaggedTransactionCount !== 1 ? 's' : ''}`
          : 'No untagged transactions',
      completed: data.untaggedTransactionCount === 0,
      action: () => onNavigate('/transactions?untaggedOnly=true', 'current-year'),
    },
    {
      id: 'uncategorized',
      type: 'warning',
      label:
        data.uncategorizedTransactionCount > 0
          ? `${data.uncategorizedTransactionCount} uncategorized transaction${data.uncategorizedTransactionCount !== 1 ? 's' : ''}`
          : 'No uncategorized transactions',
      completed: data.uncategorizedTransactionCount === 0,
      action: () => onNavigate('/budget#yearly-untracked', 'current-year'),
    },
    {
      id: 'budget-vs-income',
      type: 'warning',
      label:
        data.yearlyIncome > 0 && data.yearlyBudget > data.yearlyIncome
          ? 'Budget exceeds income'
          : 'Budget within income',
      completed: data.yearlyIncome === 0 || data.yearlyBudget <= data.yearlyIncome,
      // Informational — no navigation action
    },
  ];
}

// ── Shared collapsible section ────────────────────────────────────────────────

interface CollapsibleSectionProps {
  storageKey: string;
  loading: boolean;
  items: CheckItem[];
  /** When true the progress bar is shown and count is out of total TODO items only */
  showProgress?: boolean;
  title: string;
  /** Auto-collapse when all items are completed */
  autoCollapseWhenDone?: boolean;
}

function CollapsibleSection({
  storageKey,
  loading,
  items,
  showProgress = false,
  title,
  autoCollapseWhenDone = true,
}: CollapsibleSectionProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount && totalCount > 0;

  const [userCollapsedPref, setUserCollapsedPref] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(storageKey);
    return stored === null ? null : stored === 'true';
  });

  // Derive collapsed state: user preference overrides auto-behavior
  const collapsed = useMemo(() => {
    if (userCollapsedPref !== null) return userCollapsedPref;
    if (loading) return false;
    return autoCollapseWhenDone && allDone;
  }, [userCollapsedPref, loading, autoCollapseWhenDone, allDone]);

  const toggle = () => {
    const next = !collapsed;
    setUserCollapsedPref(next);
    localStorage.setItem(storageKey, String(next));
  };

  return (
    <div className="border-t px-2 py-3">
      {/* Header */}
      <button
        onClick={toggle}
        className="hover:bg-sidebar-accent/50 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-sidebar-foreground/80 min-w-0 flex-1 truncate text-xs font-medium">
          {title}
        </span>
        {loading ? (
          <Loader2 className="text-muted-foreground h-3 w-3 shrink-0 animate-spin" />
        ) : showProgress ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {completedCount}/{totalCount}
          </span>
        ) : null}
      </button>

      {/* Progress bar (setup checklist only) */}
      {showProgress && !loading && totalCount > 0 && (
        <div className="mt-1.5 px-2">
          <Progress value={completedCount} max={totalCount} className="h-1.5" />
        </div>
      )}

      {/* Items list */}
      {!collapsed && (
        <div className="mt-2 space-y-0.5">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center py-4 text-xs">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : (
            items.map((item) => <ChecklistItem key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── Main card (fetches data once, feeds both sections) ────────────────────────

export function SidebarTodosCard() {
  const router = useRouter();
  const pathname = usePathname();
  const { setPreset } = useTimePeriod();

  const [data, setData] = useState<AppHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/app-health');
      if (!res.ok) return;
      const json: AppHealthData = await res.json();
      setData(json);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void fetchHealth(), 0);
    return () => clearTimeout(id);
  }, [fetchHealth, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void fetchHealth();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchHealth();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchHealth]);

  const handleNavigate = useCallback(
    (href: string, preset?: string) => {
      if (preset) {
        setPreset(preset);
      }
      if (href.includes('#') && href.startsWith('/')) {
        const [path, hash] = href.split('#');
        router.push(path);
        setTimeout(() => {
          document.getElementById(hash!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } else {
        router.push(href);
      }
    },
    [router, setPreset],
  );

  const todoItems = useMemo<CheckItem[]>(
    () => (data ? buildTodoItems(data, handleNavigate) : []),
    [data, handleNavigate],
  );

  const warningItems = useMemo<CheckItem[]>(
    () => (data ? buildWarningItems(data, handleNavigate) : []),
    [data, handleNavigate],
  );

  return (
    <div className="mt-auto">
      {/* Setup Checklist — progress bar, 6 TODO items */}
      <CollapsibleSection
        storageKey={CHECKLIST_KEY}
        loading={loading}
        items={todoItems}
        showProgress
        title="Setup Checklist"
        autoCollapseWhenDone
      />

      {/* Warnings — 3 ongoing health checks */}
      <CollapsibleSection
        storageKey={WARNINGS_KEY}
        loading={loading}
        items={warningItems}
        title="Warnings"
        autoCollapseWhenDone
      />
    </div>
  );
}

// ── Checklist item row ────────────────────────────────────────────────────────

function ChecklistItem({ item }: { item: CheckItem }) {
  const isPending = !item.completed;
  const isClickable = isPending && !!item.action;

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        item.completed
          ? 'text-muted-foreground'
          : item.type === 'warning'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-600 dark:text-blue-400',
        isClickable && 'hover:bg-sidebar-accent/50 cursor-pointer',
      )}
      onClick={isClickable ? item.action : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.action?.();
              }
            }
          : undefined
      }
    >
      {/* Status icon */}
      <span className="mt-px shrink-0">
        {item.completed ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : item.type === 'warning' ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Label */}
      <span className={cn('min-w-0 flex-1 leading-snug', item.completed && 'line-through')}>
        {item.label}
      </span>

      {/* Chevron for clickable pending items */}
      {isClickable && <ChevronRight className="mt-px h-3 w-3 shrink-0 opacity-60" />}
    </div>
  );
}
