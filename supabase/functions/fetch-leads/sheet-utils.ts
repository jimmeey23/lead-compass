export interface SheetValueRange {
  range?: string;
  values?: string[][];
}

export const REQUIRED_SALES_HEADERS = [
  'Member ID',
  'Payment Date',
  'Payment Value',
  'Payment Status',
  'Cleaned Product',
  'Cleaned Category',
  'Purchase Tag',
] as const;

function normalizeHeader(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function columnIndexToLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid zero-based column index: ${index}`);
  }

  let columnNumber = index + 1;
  let letter = '';

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return letter;
}

export function getRequiredSalesColumnRanges(headers: string[], sheetName = 'sales'): string[] {
  return REQUIRED_SALES_HEADERS.map((requiredHeader) => {
    const columnIndex = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(requiredHeader));
    if (columnIndex < 0) {
      throw new Error(`Required sales column missing: ${requiredHeader}`);
    }

    const column = columnIndexToLetter(columnIndex);
    return `${sheetName}!${column}:${column}`;
  });
}

export function combineColumnValueRanges(columnRanges: SheetValueRange[]): string[][] {
  const maxRows = Math.max(0, ...columnRanges.map((range) => range.values?.length ?? 0));
  const rows: string[][] = [];

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    rows.push(columnRanges.map((range) => range.values?.[rowIndex]?.[0] ?? ''));
  }

  return rows;
}
