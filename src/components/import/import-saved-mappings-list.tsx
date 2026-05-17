import { Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { CsvMapping } from '@/components/import/constants';

interface ImportSavedMappingsListProps {
  mappings: CsvMapping[];
  selectedMappingId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function ImportSavedMappingsList({
  mappings,
  selectedMappingId,
  onSelect,
  onDelete,
  onClear,
}: ImportSavedMappingsListProps) {
  if (mappings.length === 0) return null;

  return (
    <div>
      <Label className="mb-2 block text-sm">Saved Mappings</Label>
      <div className="space-y-1.5">
        {mappings.map((m) => (
          <div
            key={m.id}
            className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-colors ${
              selectedMappingId === m.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelect(m.id)}
          >
            <div className="min-w-0">
              <span className="text-sm font-medium">{m.name}</span>
              <span className="text-muted-foreground ml-2 truncate text-xs">
                Column {m.dateColumn} · Column {m.nameColumn} · Column {m.debitColumn}/Column{' '}
                {m.creditColumn}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {selectedMappingId === m.id && <Check className="text-primary h-4 w-4" />}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {selectedMappingId && (
        <button
          className="text-muted-foreground hover:text-foreground mt-1.5 text-xs underline"
          onClick={onClear}
        >
          Clear selection (configure manually)
        </button>
      )}
      <div className="my-4 border-t" />
    </div>
  );
}
