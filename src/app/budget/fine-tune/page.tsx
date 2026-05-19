'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildTagsInDisplayOrder } from '@/lib/tag-tree';
import type { BudgetPeriodType } from '@/lib/date-utils';
import { generateSuggestions } from '@/components/fine-tune/constants';
import { SpendingHistoryChart } from '@/components/fine-tune/spending-history-chart';
import { StatsCards } from '@/components/fine-tune/stats-cards';
import { LineConfigPanel } from '@/components/fine-tune/line-config-panel';
import { SuggestionsPanel } from '@/components/fine-tune/suggestions-panel';
import type { FineTuneAnalysisResponse, FineTuneDraftConfig } from '@/types';

type SimpleLine = {
  id: string;
  name: string;
  period: string;
  amount: number;
  rollover: boolean;
  categoryId: string | null;
  tags: { id: string; name: string; color: string; isSource: boolean }[];
};

type TagOption = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

export default function FineTunePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLineId = searchParams.get('lineId');

  // Budget lines list for dropdown
  const [allLines, setAllLines] = useState<SimpleLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLineId ?? '');

  // All tags (for config panel)
  const [allTags, setAllTags] = useState<ReturnType<typeof buildTagsInDisplayOrder<TagOption>>>([]);

  // Analysis data
  const [analysis, setAnalysis] = useState<FineTuneAnalysisResponse | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Draft config (editable parameters)
  const [draft, setDraft] = useState<FineTuneDraftConfig | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch all budget lines on mount
  useEffect(() => {
    const fetchLines = async () => {
      // Get active budget first, then its lines
      const budgetsRes = await fetch('/api/budgets');
      if (!budgetsRes.ok) return;
      const budgets = await budgetsRes.json();
      if (!budgets?.length) return;

      // Active budget = latest budget whose startDate <= today (same rule as API)
      const now = new Date();
      const activeBudget = [...budgets]
        .filter((b: { startDate: string }) => new Date(b.startDate) <= now)
        .at(-1);
      if (!activeBudget) return;
      const linesRes = await fetch(`/api/budget-lines?budgetId=${activeBudget.id}`);
      if (!linesRes.ok) return;
      const lines: SimpleLine[] = await linesRes.json();
      setAllLines(lines);

      // Pre-select if lineId in URL
      if (initialLineId && lines.some((l) => l.id === initialLineId)) {
        setSelectedLineId(initialLineId);
      } else if (lines.length > 0 && !selectedLineId) {
        setSelectedLineId(lines[0].id);
      }
    };
    fetchLines();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all tags for the config panel
  useEffect(() => {
    const fetchTags = async () => {
      const res = await fetch('/api/tags');
      if (!res.ok) return;
      const data: TagOption[] = await res.json();
      const categoryTags = data.filter((t) => !t.isSource);
      setAllTags(buildTagsInDisplayOrder(categoryTags));
    };
    fetchTags();
  }, []);

  // Fetch analysis whenever selectedLineId or draft tagIds change
  const fetchAnalysis = useCallback(async (lineId: string, tagIds?: string[]) => {
    if (!lineId) return;
    setLoadingAnalysis(true);
    setAnalysisError(null);
    setSaveSuccess(false);

    let url = `/api/budget-lines/${lineId}/analysis`;
    if (tagIds && tagIds.length > 0) {
      url += `?tagIds=${tagIds.join(',')}`;
    } else if (tagIds && tagIds.length === 0) {
      // Explicitly empty — pass sentinel so API knows tags were cleared
      url += `?tagIds=`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAnalysisError(data?.error ?? 'Failed to load analysis');
        return;
      }
      const data: FineTuneAnalysisResponse = await res.json();
      setAnalysis(data);

      // Reset draft to the saved values on fresh line load
      if (!tagIds) {
        const newDraft: FineTuneDraftConfig = {
          tagIds: data.budgetLine.tags.map((t) => t.id),
          amount: data.budgetLine.amount,
          period: data.budgetLine.period,
          rollover: data.budgetLine.rollover,
        };
        setDraft(newDraft);
        setAmountInput(data.budgetLine.amount.toString());
      }
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  // Re-fetch when selected line changes
  useEffect(() => {
    if (!selectedLineId) return;
    const id = setTimeout(() => {
      void fetchAnalysis(selectedLineId);
    }, 0);
    return () => clearTimeout(id);
  }, [selectedLineId, fetchAnalysis]);

  // Handlers for draft changes
  const handleAmountInputChange = (raw: string) => {
    setAmountInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      setDraft((prev) => prev && { ...prev, amount: parsed });
    }
  };

  const handlePeriodChange = (period: BudgetPeriodType) => {
    setDraft((prev) => prev && { ...prev, period });
  };

  const handleRolloverChange = (rollover: boolean) => {
    setDraft((prev) => prev && { ...prev, rollover });
  };

  const handleTagAdd = (tagId: string) => {
    if (!draft || draft.tagIds.includes(tagId)) return;
    const newTagIds = [...draft.tagIds, tagId];
    setDraft((prev) => prev && { ...prev, tagIds: newTagIds });
    fetchAnalysis(selectedLineId, newTagIds);
  };

  const handleTagRemove = (tagId: string) => {
    if (!draft) return;
    const newTagIds = draft.tagIds.filter((id) => id !== tagId);
    setDraft((prev) => prev && { ...prev, tagIds: newTagIds });
    fetchAnalysis(selectedLineId, newTagIds);
  };

  const handleCancel = () => {
    if (!analysis) return;
    const restored: FineTuneDraftConfig = {
      tagIds: analysis.budgetLine.tags.map((t) => t.id),
      amount: analysis.budgetLine.amount,
      period: analysis.budgetLine.period,
      rollover: analysis.budgetLine.rollover,
    };
    setDraft(restored);
    setAmountInput(analysis.budgetLine.amount.toString());
    fetchAnalysis(selectedLineId);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!draft || !selectedLineId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/budget-lines/${selectedLineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: draft.amount,
          period: draft.period,
          rollover: draft.rollover,
          tagIds: draft.tagIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? 'Failed to save');
        return;
      }
      setSaveSuccess(true);
      await fetchAnalysis(selectedLineId);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Compute suggestions (client-side, updates on draft change)
  const suggestions = useMemo(() => {
    if (!analysis || !draft) return [];
    return generateSuggestions(
      analysis.stats,
      analysis.monthlyData,
      draft.amount,
      draft.period,
      draft.rollover,
    );
  }, [analysis, draft]);

  const isDirty = useMemo(() => {
    if (!analysis || !draft) return false;
    const orig = analysis.budgetLine;
    return (
      draft.amount !== orig.amount ||
      draft.period !== orig.period ||
      draft.rollover !== orig.rollover ||
      JSON.stringify([...draft.tagIds].sort()) !== JSON.stringify(orig.tags.map((t) => t.id).sort())
    );
  }, [analysis, draft]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/budget"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Budget
          </Link>
          <h1 className="text-xl font-semibold">Fine Tune Budget</h1>
        </div>
        {loadingAnalysis && <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />}
      </div>

      {/* Budget line selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Budget Line</label>
        <Select
          value={selectedLineId}
          onValueChange={(v) => {
            if (v) {
              setSelectedLineId(v);
              router.replace(`/budget/fine-tune?lineId=${v}`);
            }
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue>
              {(value: string | null) =>
                !value
                  ? 'Select a budget line…'
                  : (allLines.find((l) => l.id === value)?.name ?? 'Unknown line')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allLines.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allLines.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No budget lines found.{' '}
            <Link href="/budget" className="text-primary underline">
              Go to Budget
            </Link>{' '}
            to add some.
          </p>
        )}
      </div>

      {analysisError && (
        <Card>
          <CardContent className="p-4">
            <p className="text-destructive text-sm">{analysisError}</p>
          </CardContent>
        </Card>
      )}

      {analysis && draft && (
        <>
          {/* Chart + Config side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">
                        Spending History — {analysis.budgetLine.name}
                      </h2>
                      <p className="text-muted-foreground text-xs">
                        Since budget start:{' '}
                        {new Date(analysis.activeBudget.startDate).toLocaleDateString('en-CA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <SpendingHistoryChart
                    monthlyData={analysis.monthlyData}
                    stats={analysis.stats}
                    draftAmount={draft.amount}
                    draftPeriod={draft.period}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <LineConfigPanel
                draft={draft}
                allTags={allTags}
                amountInput={amountInput}
                onAmountInputChange={handleAmountInputChange}
                onPeriodChange={handlePeriodChange}
                onRolloverChange={handleRolloverChange}
                onTagAdd={handleTagAdd}
                onTagRemove={handleTagRemove}
              />
            </div>
          </div>

          {/* Statistics */}
          <StatsCards
            stats={analysis.stats}
            monthlyData={analysis.monthlyData}
            draftAmount={draft.amount}
            draftPeriod={draft.period}
            totalYearlyIncome={analysis.totalYearlyIncome}
            totalYearlyBudget={analysis.totalYearlyBudget}
          />

          {/* Suggestions */}
          <SuggestionsPanel suggestions={suggestions} />

          {/* Action bar */}
          <div className="bg-background/80 sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between border-t px-6 py-3 backdrop-blur">
            <div>
              {saveError && <p className="text-destructive text-sm">{saveError}</p>}
              {saveSuccess && (
                <p className="text-sm text-green-600">Budget line updated successfully!</p>
              )}
              {!saveError && !saveSuccess && isDirty && (
                <p className="text-muted-foreground text-sm">You have unsaved changes.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving || !isDirty}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !isDirty}>
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Update Budget Line
              </Button>
            </div>
          </div>
        </>
      )}

      {!analysis && !loadingAnalysis && !analysisError && selectedLineId && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">Loading analysis…</p>
          </CardContent>
        </Card>
      )}

      {!selectedLineId && allLines.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Select a budget line above to see its spending history and fine-tune its parameters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
