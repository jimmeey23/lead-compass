export interface FollowUp {
  date: string;
  comment: string;
  index: number;
}

export interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  createdAt: string;
  sourceId: string;
  sourceName: string;
  memberId: string;
  convertedAt: string;
  stageId: string;
  stageName: string;
  associate: string;
  remarks: string;
  followUps: FollowUp[];
  center: string;
  classType: string;
  hostId: string;
  status: string;
  channel: string;
  period: string;
  purchasesMade: number;
  ltv: number;
  visits: number;
  trialStatus: string;
  conversionStatus: string;
  retentionStatus: string;
}

export interface AssociateStats {
  name: string;
  totalLeads: number;
  converted: number;
  lost: number;
  active: number;
  conversionRate: number;
  avgFollowUps: number;
  overdueFollowUps: number;
  totalLtv: number;
  avgLtv: number;
  avgVisits: number;
  scheduledFollowUps: number;
  closeRate: number;
  centersCovered: number;
}

export type ViewMode = 'table' | 'compact' | 'periodic' | 'journey-flow' | 'stage-board' | 'center-board' | 'associate' | 'comparison';

export type GroupableLeadKey =
  | 'fullName'
  | 'createdAt'
  | 'createdWeek'
  | 'createdMonth'
  | 'createdQuarter'
  | 'createdYear'
  | 'associate'
  | 'center'
  | 'sourceName'
  | 'stageName'
  | 'status'
  | 'remarks'
  | 'channel'
  | 'conversionStatus'
  | 'trialStatus'
  | 'classType';

export interface LeadOptionSets {
  associates: string[];
  statuses: string[];
  centers: string[];
  channels: string[];
  conversionStatuses: string[];
  trialStatuses: string[];
  sourceNames: string[];
  stageNames: string[];
}

export type DatePreset = 'all' | '7days' | 'lastWeek' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'custom';

export interface FilterState {
  associate: string;
  status: string[];
  stageName: string[];
  center: string;
  sourceName: string[];
  channel: string[];
  conversionStatus: string[];
  trialStatus: string[];
  search: string;
  datePreset: DatePreset;
  customDateFrom: string;
  customDateTo: string;
  convertedDatePreset: DatePreset;
  convertedDateFrom: string;
  convertedDateTo: string;
}

export const defaultFilters: FilterState = {
  associate: 'all',
  status: [],
  stageName: [],
  center: 'all',
  sourceName: [],
  channel: [],
  conversionStatus: [],
  trialStatus: [],
  search: '',
  datePreset: 'lastWeek',
  customDateFrom: '',
  customDateTo: '',
  convertedDatePreset: 'all',
  convertedDateFrom: '',
  convertedDateTo: '',
};

export function parseDateStr(dateStr: string): Date | null {
  if (!dateStr || dateStr === '-') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const isoDate = new Date(`${dateStr}T00:00:00`);
    return isNaN(isoDate.getTime()) ? null : isoDate;
  }
  // Try DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const normalizedYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    const d = new Date(`${normalizedYear}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d.getTime())) return d;
  }
  // Try YYYY-MM-DD
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function getDateRange(preset: DatePreset, customDateFrom?: string, customDateTo?: string): { from: Date; to: Date } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = (date: Date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  };
  
  switch (preset) {
    case '7days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from, to: endOfDay(today) };
    }
    case 'thisWeek': {
      const day = today.getDay();
      const from = new Date(today);
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1));
      return { from, to: endOfDay(today) };
    }
    case 'lastWeek': {
      const day = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(thisMonday.getDate() - (day === 0 ? 6 : day - 1));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { from: lastMonday, to: endOfDay(lastSunday) };
    }
    case 'thisMonth': {
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfDay(today) };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to: endOfDay(to) };
    }
    case 'thisQuarter': {
      const qStart = Math.floor(today.getMonth() / 3) * 3;
      return { from: new Date(today.getFullYear(), qStart, 1), to: endOfDay(today) };
    }
    case 'lastQuarter': {
      const qStart = Math.floor(today.getMonth() / 3) * 3;
      const from = new Date(today.getFullYear(), qStart - 3, 1);
      const to = new Date(today.getFullYear(), qStart, 0);
      return { from, to: endOfDay(to) };
    }
    case 'thisYear': {
      return { from: new Date(today.getFullYear(), 0, 1), to: endOfDay(today) };
    }
    case 'lastYear': {
      return {
        from: new Date(today.getFullYear() - 1, 0, 1),
        to: endOfDay(new Date(today.getFullYear() - 1, 11, 31)),
      };
    }
    case 'custom': {
      const from = parseDateStr(customDateFrom ?? '');
      const to = parseDateStr(customDateTo ?? '');
      if (!from && !to) return null;
      return {
        from: from ?? new Date(2000, 0, 1),
        to: to ? endOfDay(to) : endOfDay(today),
      };
    }
    default: return null;
  }
}
