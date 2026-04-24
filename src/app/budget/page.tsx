'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { BudgetSummaryLine } from '@/types';

type TagOption = { id: string; name: string; color: string; isSource: boolean };

export default function BudgetPage() {
  const { period } = useTimePeriod();
  const [summaryLines, setSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [formAmount, setFormAmount] = useState('');
  const [formRollover, setFormRollover] = useState(false);
  const [formTagIds, setFormTagIds] = useState<string[]>([]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const res = await fetch(`/api/budget/summary?${params}`);
    const data = await res.json();
    setSummaryLines(data);
    setLoading(false);
  }, [period]);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data.filter((t: TagOption) => !t.isSource));
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  const resetForm = () => {
    setFormName('');
    setFormPeriod('monthly');
    setFormAmount('');
    setFormRollover(false);
    setFormTagIds([]);
    setEditingId(null);
  };

  const handleEdit = (line: BudgetSummaryLine) => {
    setEditingId(line.budgetLine.id);
    setFormName(line.budgetLine.name);
    setFormPeriod(line.budgetLine.period);
    setFormAmount(line.budgetLine.amount.toString());
    setFormRollover(line.budgetLine.rollover);
    setFormTagIds(line.budgetLine.tags.map((t) => t.id));
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget line?')) return;
    await fetch(`/api/budget-lines/${id}`, { method: 'DELETE' });
    fetchSummary();
  };

  const handleSubmit = async () => {
    const payload = {
      name: formName,
      period: formPeriod,
      amount: formAmount,
      rollover: formRollover,
      tagIds: formTagIds,
    };

    if (editingId) {
      await fetch(`/api/budget-lines/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/budget-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setDialogOpen(false);
    resetForm();
    fetchSummary();
  };

  const toggleFormTag = (tagId: string) => {
    setFormTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const totalBudget = summaryLines.reduce((sum, l) => sum + l.effectiveBudget, 0);
  const totalActual = summaryLines.reduce((sum, l) => sum + l.actualSpending, 0);
  const totalRemaining = totalBudget - totalActual;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground text-sm">Viewing: {period.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />
              Add Budget Line
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Budget Line' : 'Create Budget Line'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Groceries" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Period</Label>
                    <Select value={formPeriod} onValueChange={(v) => { if (v !== null) setFormPeriod(v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="500.00" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rollover" checked={formRollover} onChange={(e) => setFormRollover(e.target.checked)} className="rounded" />
                  <Label htmlFor="rollover">Enable rollover (carry unspent/overspent to next period)</Label>
                </div>
                <div>
                  <Label>Tags</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((tag) => {
                      const isSelected = formTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleFormTag(tag.id)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors',
                            isSelected ? 'border-current' : 'border-transparent opacity-50',
                          )}
                          style={{ color: tag.color, backgroundColor: `${tag.color}15` }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={!formName || !formAmount}>
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', totalRemaining >= 0 ? 'text-green-600' : 'text-red-600')}>
              {formatCurrency(totalRemaining)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Lines Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryLines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  No budget lines yet. Create one to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              summaryLines.map((line) => (
                <TableRow key={line.budgetLine.id}>
                  <TableCell className="font-medium">
                    {line.budgetLine.name}
                    {line.budgetLine.rollover && (
                      <span className="ml-1 text-xs text-muted-foreground" title="Rollover enabled">🔄</span>
                    )}
                    {line.rolloverAmount !== 0 && (
                      <div className="text-xs text-muted-foreground">
                        Rollover: {formatCurrency(line.rolloverAmount)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {line.budgetLine.tags.map((t) => (
                        <TagBadge key={t.id} name={t.name} color={t.color} className="text-xs" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{line.budgetLine.period}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.effectiveBudget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.actualSpending)}</TableCell>
                  <TableCell className={cn('text-right font-medium', line.remaining >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {formatCurrency(line.remaining)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(line)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(line.budgetLine.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
