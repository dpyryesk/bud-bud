interface CsvRawPreviewProps {
  csvHeaders: string[];
  csvRawPreview: string[][];
  skipFirstRow?: boolean;
  className?: string;
}

export default function CsvRawPreview({
  csvHeaders,
  csvRawPreview,
  skipFirstRow = false,
  className,
}: CsvRawPreviewProps) {
  if (csvHeaders.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2 text-sm font-medium">
        File preview — {csvHeaders.length} columns detected
      </p>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {csvHeaders.map((column, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  Column {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvRawPreview.map((row, i) => (
              <tr key={i} className={`border-t ${skipFirstRow && i === 0 ? 'opacity-40' : ''}`}>
                {csvHeaders.map((column, j) => (
                  <td
                    key={j}
                    className={`max-w-48 truncate px-3 py-1.5 ${skipFirstRow && i === 0 ? 'italic' : ''}`}
                  >
                    {skipFirstRow && i === 0 && j === 0 ? (
                      <span className="text-muted-foreground mr-1 font-medium not-italic">
                        [header]
                      </span>
                    ) : null}
                    {row[Number(column) - 1] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
