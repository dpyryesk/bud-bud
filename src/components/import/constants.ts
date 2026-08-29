// ---- Local types ----

export type CsvMapping = {
  id: string;
  name: string;
  dateColumn: string;
  nameColumn: string;
  debitColumn: string;
  creditColumn: string;
  sourceColumn: string;
  dateFormat: string;
  skipFirstRow: boolean;
  sourceTagId: string | null;
};

export type SourceTag = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  order: number;
};

export type Step = 'upload' | 'configure' | 'preview' | 'done';

// ---- Constants ----

export const STEPS: Step[] = ['upload', 'configure', 'preview', 'done'];
export const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload',
  configure: 'Configure',
  preview: 'Preview',
  done: 'Done',
};

export const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
  { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
];
