export interface SummaryCountRow {
  label: string;
  count: number;
  share: number;
  detail?: string;
  groupedCount?: number;
}

export interface GroupedSummaryDescription {
  countLabel: string;
  detailLabel: string;
  tooltip: string;
}

function singularSummaryTitle(title: string): string {
  const normalized = title.trim().toLowerCase();
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized || 'item';
}

export function getGroupedSummaryDescription(title: string, row: SummaryCountRow): GroupedSummaryDescription | null {
  const detail = row.detail?.trim();
  if (!detail || !row.groupedCount || row.groupedCount <= 1) return null;

  const itemName = singularSummaryTitle(title);
  const pluralItemName = row.groupedCount === 1 ? itemName : `${itemName}s`;

  return {
    countLabel: `${row.groupedCount} ${pluralItemName} grouped`,
    detailLabel: `Includes: ${detail}`,
    tooltip: detail,
  };
}
