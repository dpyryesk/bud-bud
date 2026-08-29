export type CsvMappingFormValues = {
  name: string;
  dateColumn: string;
  nameColumn: string;
  debitColumn: string;
  creditColumn: string;
  sourceColumn: string | null;
  dateFormat: string;
  sourceTagId: string | null;
  sourceValueTagMap: Record<string, string>;
  skipFirstRow: boolean;
};

export function buildImportMapping(values: CsvMappingFormValues) {
  if (!values.dateColumn || !values.nameColumn || !values.debitColumn || !values.creditColumn) {
    return null;
  }

  return {
    name: values.name,
    dateColumn: values.dateColumn,
    nameColumn: values.nameColumn,
    debitColumn: values.debitColumn,
    creditColumn: values.creditColumn,
    sourceColumn: values.sourceColumn && values.sourceColumn !== 'none' ? values.sourceColumn : '',
    dateFormat: values.dateFormat,
    sourceTagId: values.sourceTagId && values.sourceTagId !== 'none' ? values.sourceTagId : null,
    sourceValueTagMap: Object.fromEntries(
      Object.entries(values.sourceValueTagMap).filter(([, tagId]) => tagId),
    ),
    skipFirstRow: values.skipFirstRow,
  };
}
