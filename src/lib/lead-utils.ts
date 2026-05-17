import { getDateRange, parseDateStr } from '@/types/leads';
import type { Lead, GroupableLeadKey, LeadOptionSets, FilterState } from '@/types/leads';

const DATE_ARTIFACT_RE = /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}.*$/;

const CENTER_ALIASES: Array<[RegExp, string]> = [
  [/kwality\s*(?:house|hse)?\s*,?\s*(?:kemps|kemp'?s)\s*(?:corner|cor|crnr)?/i, 'Kwality House, Kemps Corner'],
  [/(?:kemps|kemp'?s)\s*(?:corner|cor|crnr).*kwality/i, 'Kwality House, Kemps Corner'],
  [/physique\s*57.*(?:kemps|kemp'?s)/i, 'Kwality House, Kemps Corner'],
  [/supreme\s*(?:headquarters|hq).*(bandra)/i, 'Supreme Headquarters, Bandra'],
  [/supreme\s*(?:headquarters|hq).*(juhu)/i, 'Supreme Headquarters, Juhu'],
  [/supreme\s*(?:headquarters|hq).*(andheri)/i, 'Supreme Headquarters, Andheri'],
  [/supreme\s*(?:headquarters|hq).*(powai)/i, 'Supreme Headquarters, Powai'],
  [/supreme\s*(?:headquarters|hq).*(thane)/i, 'Supreme Headquarters, Thane'],
];

const DISQUALIFIED_STAGE_VALUES = new Set([
  'called - did not answer',
  'called - invalid contact no',
  'no response after trial',
  'client unresponsive',
]);

const GROUPABLE_VALUE_KEYS: GroupableLeadKey[] = [
  'fullName',
  'createdAt',
  'createdWeek',
  'createdMonth',
  'createdQuarter',
  'createdYear',
  'associate',
  'center',
  'sourceName',
  'stageName',
  'status',
  'remarks',
  'channel',
  'conversionStatus',
  'trialStatus',
  'classType',
];

export const GROUPABLE_COLUMNS: Array<{ key: GroupableLeadKey; label: string }> = [
  { key: 'fullName', label: 'Lead' },
  { key: 'createdAt', label: 'Date' },
  { key: 'createdWeek', label: 'Week Bucket' },
  { key: 'createdMonth', label: 'Month Bucket' },
  { key: 'createdQuarter', label: 'Quarter Bucket' },
  { key: 'createdYear', label: 'Year Bucket' },
  { key: 'associate', label: 'Associate' },
  { key: 'center', label: 'Center' },
  { key: 'sourceName', label: 'Source' },
  { key: 'stageName', label: 'Stage' },
  { key: 'status', label: 'Status' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'channel', label: 'Channel' },
  { key: 'conversionStatus', label: 'Conversion' },
  { key: 'trialStatus', label: 'Trial Status' },
  { key: 'classType', label: 'Type' },
];

export interface LeadRenderGroupRow {
  type: 'group';
  id: string;
  depth: number;
  label: string;
  groupKey: GroupableLeadKey;
  count: number;
  groupNumber: string;
  groupMetrics: {
    leadCount: number;
    converted: number;
    trialsCompleted: number;
    trialsScheduled: number;
    disqualified: number;
  };
  parentGroupIds: string[];
}

export interface LeadRenderDataRow {
  type: 'lead';
  id: string;
  depth: number;
  lead: Lead;
  rowNumber: number;
  parentGroupIds: string[];
}

export type LeadRenderRow = LeadRenderGroupRow | LeadRenderDataRow;

export function cleanLooseText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(DATE_ARTIFACT_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function titleCaseWord(word: string): string {
  if (!word) return '';
  if (/^[A-Z0-9]{2,}$/.test(word)) return word;
  const lower = word.toLowerCase();
  return lower.replace(/(^[a-z])|([-'][a-z])/g, (match) => match.toUpperCase());
}

export function titleCase(value: string | null | undefined): string {
  const cleaned = cleanLooseText(value);
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .map((word) => titleCaseWord(word))
    .join(' ')
    .replace(/\bAnd\b/g, 'and');
}

export function normalizePersonName(value: string | null | undefined): string {
  const cleaned = cleanLooseText(value);
  if (!cleaned) return '';
  return titleCase(cleaned);
}

export function normalizeCenterName(value: string | null | undefined): string {
  const cleaned = cleanLooseText(value)
    .replace(/\bshq\b/gi, 'Supreme HQ')
    .replace(/\bkc\b/gi, 'Kemps Corner')
    .replace(/[|/]+/g, ',')
    .replace(/\s*-\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const alias = CENTER_ALIASES.find(([pattern]) => pattern.test(cleaned));
  if (alias) return alias[1];

  return cleaned
    .split(',')
    .map((part) => titleCase(part.trim()))
    .filter(Boolean)
    .join(', ');
}

export function formatStudioName(value: string | null | undefined): string {
  const center = normalizeCenterName(value);
  if (!center) return '';
  return center.replace('Headquarters', 'HQ');
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = normalizePersonName(fullName);
  if (!cleaned) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = cleaned.split(' ');
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

export function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === '-') return null;

  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(`${normalizedYear}-${month}-${day}`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSalesConvertedLead(lead: Lead): boolean {
  return (
    cleanLooseText(lead.conversionStatus).toLowerCase() === 'converted' &&
    Boolean(parseFlexibleDate(lead.convertedAt))
  );
}

export function formatMomenceDate(dateStr: string): string {
  const date = parseFlexibleDate(dateStr) ?? new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

export function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function getElapsedDaysLabel(dateStr: string): string {
  const parsedDate = parseFlexibleDate(dateStr);
  if (!parsedDate) return 'No date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(parsedDate);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays > 1) return `${diffDays} days ago`;

  const daysAhead = Math.abs(diffDays);
  return daysAhead === 1 ? 'In 1 day' : `In ${daysAhead} days`;
}

export function getCurrentWeekRangeLabel(reference = new Date()): string {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(reference.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return `${formatDateLabel(monday)} – ${formatDateLabel(sunday)}`;
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + mondayOffset);
  return result;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function formatMonthBucket(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatQuarterBucket(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function formatYearBucket(date: Date): string {
  return String(date.getFullYear());
}

export function getLeadGroupLabel(lead: Lead, key: GroupableLeadKey): string {
  if (!GROUPABLE_VALUE_KEYS.includes(key)) return '—';

  if (key === 'createdAt' || key === 'createdWeek' || key === 'createdMonth' || key === 'createdQuarter' || key === 'createdYear') {
    const parsedDate = parseFlexibleDate(lead.createdAt);
    if (!parsedDate) {
      return cleanLooseText(lead.createdAt) || '—';
    }

    if (key === 'createdAt') {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
    }

    if (key === 'createdWeek') {
      const start = getWeekStart(parsedDate);
      const end = getWeekEnd(parsedDate);
      return `${formatDateLabel(start)} – ${formatDateLabel(end)} ${start.getFullYear()}`;
    }

    if (key === 'createdMonth') return formatMonthBucket(parsedDate);
    if (key === 'createdQuarter') return formatQuarterBucket(parsedDate);
    return formatYearBucket(parsedDate);
  }

  const value = lead[key];
  return cleanLooseText(typeof value === 'string' ? value : String(value ?? '')) || '—';
}

export function buildLeadOptions(leads: Lead[]): LeadOptionSets {
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return {
    associates: unique(leads.map((lead) => lead.associate)),
    statuses: unique(leads.map((lead) => lead.status)),
    centers: unique(leads.map((lead) => lead.center)),
    channels: unique(leads.map((lead) => lead.channel)),
    conversionStatuses: unique(leads.map((lead) => lead.conversionStatus)),
    trialStatuses: unique(leads.map((lead) => lead.trialStatus)),
    sourceNames: unique(leads.map((lead) => lead.sourceName)),
    stageNames: unique(leads.map((lead) => lead.stageName)),
  };
}

function normalizeHeader(value: string): string {
  return cleanLooseText(value).toLowerCase();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
}

function getCell(row: string[], index: number): string {
  return index >= 0 ? cleanLooseText(row[index] || '') : '';
}

function isSuccessfulSale(status: string): boolean {
  return !status || /^succeeded$/i.test(status);
}

function parseMoneyValue(value: string): number {
  const normalized = cleanLooseText(value).replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatConversionDateForLead(value: string): string {
  return cleanLooseText(value);
}

function getSalesConversionRows(salesRows: string[][]) {
  const [headers = [], ...rows] = salesRows;
  const memberIdIndex = findColumnIndex(headers, ['Member ID']);
  const paymentDateIndex = findColumnIndex(headers, ['Payment Date']);
  const paymentValueIndex = findColumnIndex(headers, ['Payment Value']);
  const paymentStatusIndex = findColumnIndex(headers, ['Payment Status']);
  const cleanedProductIndex = findColumnIndex(headers, ['Cleaned Product']);
  const cleanedCategoryIndex = findColumnIndex(headers, ['Cleaned Category']);
  const purchaseTagIndex = findColumnIndex(headers, ['Purchase Tag']);

  if (memberIdIndex < 0 || paymentDateIndex < 0) return [];

  return rows
    .map((row) => ({
      memberId: getCell(row, memberIdIndex),
      paymentDate: getCell(row, paymentDateIndex),
      paymentValue: parseMoneyValue(getCell(row, paymentValueIndex)),
      paymentStatus: getCell(row, paymentStatusIndex),
      cleanedProduct: getCell(row, cleanedProductIndex),
      cleanedCategory: getCell(row, cleanedCategoryIndex),
      purchaseTag: getCell(row, purchaseTagIndex),
      parsedPaymentDate: parseFlexibleDate(getCell(row, paymentDateIndex)),
    }))
    .filter((sale) => (
      sale.memberId &&
      sale.paymentDate &&
      sale.parsedPaymentDate &&
      sale.paymentValue > 0 &&
      isSuccessfulSale(sale.paymentStatus) &&
      !/\bretail\b/i.test(sale.cleanedCategory) &&
      !/(?:2\s*for\s*1|money\s*credits?)/i.test(sale.cleanedProduct)
    ));
}

export function enrichLeadsWithSalesConversions(leads: Lead[], salesRows: string[][]): Lead[] {
  const salesByMemberId = new Map<string, ReturnType<typeof getSalesConversionRows>>();
  const sales = getSalesConversionRows(salesRows);

  for (const sale of sales) {
    const memberSales = salesByMemberId.get(sale.memberId) ?? [];
    memberSales.push(sale);
    salesByMemberId.set(sale.memberId, memberSales);
  }

  return leads.map((lead) => {
    const leadCreatedAt = parseFlexibleDate(lead.createdAt);
    const memberSales = salesByMemberId.get(cleanLooseText(lead.memberId)) ?? [];
    const sale = memberSales
      .filter((candidate) => {
        if (!candidate.parsedPaymentDate) return false;
        if (!leadCreatedAt) return true;
        return candidate.parsedPaymentDate > leadCreatedAt;
      })
      .sort((a, b) => {
        const aTime = a.parsedPaymentDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.parsedPaymentDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })[0];

    if (!sale) {
      return {
        ...lead,
        convertedAt: '',
        conversionStatus: '',
      };
    }

    return {
      ...lead,
      convertedAt: formatConversionDateForLead(sale.paymentDate),
      conversionStatus: 'Converted',
    };
  });
}

export function applyLeadFilters(leads: Lead[], filters: FilterState): Lead[] {
  const createdDateRange = getDateRange(filters.datePreset, filters.customDateFrom, filters.customDateTo);
  const convertedDateRange = getDateRange(filters.convertedDatePreset, filters.convertedDateFrom, filters.convertedDateTo);

  return leads.filter((lead) => {
    if (filters.associate !== 'all' && lead.associate !== filters.associate) return false;
    if (filters.status.length > 0 && !filters.status.includes(lead.status)) return false;
    if (filters.stageName.length > 0 && !filters.stageName.includes(lead.stageName)) return false;
    if (filters.center !== 'all' && cleanLooseText(lead.center).toLowerCase() !== cleanLooseText(filters.center).toLowerCase()) return false;
    if (filters.sourceName.length > 0 && !filters.sourceName.includes(lead.sourceName)) return false;
    if (filters.channel.length > 0 && !filters.channel.includes(lead.channel)) return false;
    if (filters.conversionStatus.length > 0 && !filters.conversionStatus.includes(lead.conversionStatus)) return false;
    if (filters.trialStatus.length > 0 && !filters.trialStatus.includes(lead.trialStatus)) return false;

    if (createdDateRange) {
      const created = parseDateStr(lead.createdAt);
      if (!created || created < createdDateRange.from || created > createdDateRange.to) return false;
    }

    if (convertedDateRange) {
      const converted = parseDateStr(lead.convertedAt);
      if (!converted || converted < convertedDateRange.from || converted > convertedDateRange.to) return false;
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !lead.fullName.toLowerCase().includes(search) &&
        !lead.email.toLowerCase().includes(search) &&
        !lead.phoneNumber.includes(search) &&
        !lead.id.includes(search) &&
        !lead.associate.toLowerCase().includes(search)
      ) return false;
    }

    return true;
  });
}

export function getDateNeutralFilters(filters: FilterState): FilterState {
  return {
    ...filters,
    datePreset: 'all',
    customDateFrom: '',
    customDateTo: '',
    convertedDatePreset: 'all',
    convertedDateFrom: '',
    convertedDateTo: '',
  };
}

export function getLeadFieldValue(lead: Lead, key: GroupableLeadKey): string {
  return getLeadGroupLabel(lead, key);
}

export function buildStageBreakdown(leads: Lead[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();

  for (const lead of leads) {
    const label = cleanLooseText(lead.stageName) || 'Unassigned';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const priorityMatchers = [
    /trial scheduled/i,
    /trial/i,
    /membership sold|converted|sold/i,
    /not interested|lost/i,
    /proximity/i,
  ];

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const aPriority = priorityMatchers.findIndex((pattern) => pattern.test(a.label));
      const bPriority = priorityMatchers.findIndex((pattern) => pattern.test(b.label));
      const safeA = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
      const safeB = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;
      if (safeA !== safeB) return safeA - safeB;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
}

export function buildMainStageSummary(leads: Lead[]): Array<{ label: string; count: number; share: number }> {
  const stageBuckets = [
    { label: 'Trial Scheduled', pattern: /trial scheduled/i },
    { label: 'Trials', pattern: /(^|\s)trial($|\s)|trial completed|trial done/i },
    { label: 'Membership Sold', pattern: /membership sold|sold|converted/i },
    { label: 'Not Interested', pattern: /not interested|lost/i },
    { label: 'Proximity', pattern: /proximity/i },
  ];

  const total = leads.length || 1;

  return stageBuckets.map((bucket) => {
    const count = leads.filter((lead) => bucket.pattern.test(cleanLooseText(lead.stageName))).length;
    return {
      label: bucket.label,
      count,
      share: (count / total) * 100,
    };
  });
}

export function buildCountSummary(
  leads: Lead[],
  key: Extract<GroupableLeadKey, 'sourceName' | 'stageName'>,
) {
  const counts = new Map<string, number>();

  for (const lead of leads) {
    const label = getLeadGroupLabel(lead, key);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = leads.length || 1;

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      share: (count / total) * 100,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
}

const STAGE_SUMMARY_GROUPS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Membership Sold / Converted', patterns: [/membership\s*sold/i, /\bconverted\b/i, /\bsold\b/i] },
  { label: 'Trial Scheduled', patterns: [/trial\s*scheduled/i, /trial\s*booked/i] },
  { label: 'Trial Completed', patterns: [/trial\s*(completed|complete|done|finished)/i] },
  { label: 'Trial Pending', patterns: [/trial/i] },
  { label: 'No Response', patterns: [/no\s*response/i, /did\s*not\s*answer/i, /unresponsive/i] },
  { label: 'Not Interested / Lost', patterns: [/not\s*interested/i, /\blost\b/i, /lead\s*dropped/i, /\bdropped\b/i, /\bdead\b/i, /cancel/i] },
  { label: 'Invalid Contact', patterns: [/invalid\s*contact/i, /invalid\s*(number|no)/i] },
];

function getCanonicalStageSummaryLabel(stageName: string): string {
  const cleaned = cleanLooseText(stageName) || 'Unassigned';
  const group = STAGE_SUMMARY_GROUPS.find((item) => item.patterns.some((pattern) => pattern.test(cleaned)));
  return group?.label ?? cleaned;
}

export function buildStageCountSummary(leads: Lead[]) {
  const counts = new Map<string, { label: string; count: number; uniqueStages: Set<string> }>();

  for (const lead of leads) {
    const uniqueStage = cleanLooseText(lead.stageName) || 'Unassigned';
    const label = getCanonicalStageSummaryLabel(uniqueStage);
    const current = counts.get(label) ?? { label, count: 0, uniqueStages: new Set<string>() };
    current.count += 1;
    current.uniqueStages.add(uniqueStage);
    counts.set(label, current);
  }

  const total = leads.length || 1;

  return Array.from(counts.values())
    .map((row) => ({
      label: row.label,
      count: row.count,
      share: (row.count / total) * 100,
      detail: Array.from(row.uniqueStages).sort((a, b) => a.localeCompare(b)).join(', '),
      groupedCount: row.uniqueStages.size,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
}

function buildGroupMetrics(leads: Lead[]) {
  const stageValue = (lead: Lead) => cleanLooseText(lead.stageName).toLowerCase();

  const converted = leads.filter(isSalesConvertedLead).length;
  const trialsCompleted = leads.filter((lead) => /trial completed|trial done|trial finished/.test(stageValue(lead))).length;
  const trialsScheduled = leads.filter((lead) => /trial scheduled/.test(stageValue(lead))).length;
  const disqualified = leads.filter((lead) => DISQUALIFIED_STAGE_VALUES.has(stageValue(lead))).length;

  return {
    leadCount: leads.length,
    converted,
    trialsCompleted,
    trialsScheduled,
    disqualified,
  };
}

export function flattenGroupedLeads(leads: Lead[], groupKeys: GroupableLeadKey[]): LeadRenderRow[] {
  const indexed = leads.map((lead) => ({ lead }));

  if (groupKeys.length === 0) {
    return indexed.map(({ lead }, index) => ({
      type: 'lead' as const,
      id: `${lead.id}-${index + 1}`,
      depth: 0,
      lead,
      rowNumber: index + 1,
      parentGroupIds: [],
    }));
  }

  let visibleLeadCounter = 0;

  const walk = (
    entries: Array<{ lead: Lead }>,
    keys: GroupableLeadKey[],
    depth: number,
    path: string,
    parentGroupIds: string[],
    numberPrefix: string,
  ): LeadRenderRow[] => {
    if (keys.length === 0) {
      return entries.map(({ lead }) => {
        visibleLeadCounter += 1;
        return {
          type: 'lead' as const,
          id: `${path}-${lead.id}-${visibleLeadCounter}`,
          depth,
          lead,
          rowNumber: visibleLeadCounter,
          parentGroupIds,
        };
      });
    }

    const [currentKey, ...rest] = keys;
    const grouped = new Map<string, Array<{ lead: Lead }>>();

    for (const entry of entries) {
      const groupValue = getLeadFieldValue(entry.lead, currentKey);
      if (!grouped.has(groupValue)) {
        grouped.set(groupValue, []);
      }
      grouped.get(groupValue)?.push(entry);
    }

    const rows: LeadRenderRow[] = [];
    let groupIndex = 0;

    for (const [label, groupEntries] of grouped.entries()) {
      groupIndex += 1;
      const id = `${path}-${currentKey}-${label}`;
      const groupNumber = numberPrefix ? `${numberPrefix}.${groupIndex}` : String(groupIndex);
      rows.push({
        type: 'group',
        id,
        depth,
        label,
        groupKey: currentKey,
        count: groupEntries.length,
        groupNumber,
        groupMetrics: buildGroupMetrics(groupEntries.map(({ lead }) => lead)),
        parentGroupIds,
      });
      rows.push(...walk(groupEntries, rest, depth + 1, id, [...parentGroupIds, id], groupNumber));
    }

    return rows;
  };

  return walk(indexed, groupKeys, 0, 'root', [], '');
}

export function buildSourceIdMap(leads: Lead[]): Record<string, number> {
  return leads.reduce<Record<string, number>>((acc, lead) => {
    const label = cleanLooseText(lead.sourceName);
    const id = Number(lead.sourceId);
    if (label && Number.isFinite(id)) {
      acc[label] = id;
    }
    return acc;
  }, {});
}
