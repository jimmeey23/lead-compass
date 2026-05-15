import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, FollowUp } from '@/types/leads';
import {
  cleanLooseText,
  enrichLeadsWithSalesConversions,
  formatStudioName,
  formatMomenceDate,
  normalizeCenterName,
  normalizePersonName,
  splitFullName,
} from '@/lib/lead-utils';

const LEADS_CACHE_KEY = 'lead-compass:leads:v4';
const LEADS_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

interface LeadsCacheEntry {
  timestamp: number;
  leads: Lead[];
}

export interface LeadUpdatePayload {
  leadId: string;
  payload: Record<string, unknown>;
}

function isValidLeadName(rawName: string): boolean {
  const cleanedName = cleanLooseText(rawName);

  if (!cleanedName) return false;
  if (/^[-–—.#\s]+$/.test(cleanedName)) return false;
  if (/^#.*preset#/i.test(cleanedName)) return false;
  if (/#ff\b/i.test(cleanedName) && /preset/i.test(cleanedName)) return false;

  const meaningfulCharacters = cleanedName.replace(/[-–—.#\s]/g, '');
  return /[a-z]/i.test(meaningfulCharacters);
}

function parseRow(row: string[]): Lead {
  const followUps: FollowUp[] = [];
  for (let i = 0; i < 4; i++) {
    const dateIdx = 12 + i * 2;
    const commentIdx = 13 + i * 2;
    followUps.push({
      date: row[dateIdx] || '',
      comment: row[commentIdx] || '',
      index: i + 1,
    });
  }

  const fullName = normalizePersonName(row[1] || '');

  return {
    id: row[0] || '',
    fullName,
    phoneNumber: cleanLooseText(row[2] || ''),
    email: cleanLooseText(row[3] || ''),
    createdAt: row[4] || '',
    sourceId: row[5] || '',
    sourceName: normalizePersonName(row[6] || ''),
    memberId: row[7] || '',
    convertedAt: row[8] || '',
    stageId: row[32] || '',
    stageName: normalizePersonName(row[9] || ''),
    associate: normalizePersonName(row[10] || ''),
    remarks: cleanLooseText(row[11] || ''),
    followUps,
    center: normalizeCenterName(row[20] || ''),
    classType: normalizePersonName(row[21] || ''),
    hostId: row[22] || '',
    status: normalizePersonName(row[23] || ''),
    channel: normalizePersonName(row[24] || ''),
    period: row[25] || '',
    purchasesMade: parseInt(row[26]) || 0,
    ltv: parseFloat(row[27]) || 0,
    visits: parseInt(row[28]) || 0,
    trialStatus: normalizePersonName(row[29] || ''),
    conversionStatus: normalizePersonName(row[30] || ''),
    retentionStatus: normalizePersonName(row[31] || ''),
  };
}

function readCachedLeads(): LeadsCacheEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LEADS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LeadsCacheEntry>;
    if (!Array.isArray(parsed.leads) || typeof parsed.timestamp !== 'number') {
      return null;
    }

    if (Date.now() - parsed.timestamp > LEADS_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(LEADS_CACHE_KEY);
      return null;
    }

    return {
      timestamp: parsed.timestamp,
      leads: parsed.leads as Lead[],
    };
  } catch {
    return null;
  }
}

function writeCachedLeads(leads: Lead[]) {
  if (typeof window === 'undefined') return;

  const entry: LeadsCacheEntry = {
    timestamp: Date.now(),
    leads,
  };

  try {
    window.localStorage.setItem(LEADS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.functions.invoke('fetch-leads');
  if (error) throw error;
  
  const rows: string[][] = data.values || [];
  const salesRows: string[][] = data.salesValues || [];
  // Skip header row
  if (rows.length <= 1) return [];
  const leads = rows
    .slice(1)
    .filter((row) => isValidLeadName(row[1] || ''))
    .map(parseRow);
  const enrichedLeads = enrichLeadsWithSalesConversions(leads, salesRows);

  writeCachedLeads(enrichedLeads);
  return enrichedLeads;
}

export function useLeadsData() {
  const cachedLeads = readCachedLeads();

  return useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
    initialData: cachedLeads?.leads,
    initialDataUpdatedAt: cachedLeads?.timestamp,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

async function updateLead(payload: LeadUpdatePayload) {
  const { data, error } = await supabase.functions.invoke('update-lead', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  return data;
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLead,
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LEADS_CACHE_KEY);
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function buildMomencePayload(lead: Lead, draft: Partial<Lead>) {
  const fullName = normalizePersonName(draft.fullName ?? lead.fullName);
  const { firstName, lastName } = splitFullName(fullName);
  const sourceId = Number(draft.sourceId ?? lead.sourceId);

  return {
    phoneNumber: cleanLooseText(draft.phoneNumber ?? lead.phoneNumber),
    sourceId: Number.isFinite(sourceId) && sourceId > 0 ? sourceId : '',
    firstName,
    lastName,
    email: cleanLooseText(draft.email ?? lead.email),
    date: formatMomenceDate(draft.createdAt ?? lead.createdAt),
    remarks: cleanLooseText(draft.remarks ?? lead.remarks),
    center: normalizeCenterName(draft.center ?? lead.center),
    associate: normalizePersonName(draft.associate ?? lead.associate),
    type: normalizePersonName(draft.classType ?? lead.classType),
    studio: formatStudioName(draft.center ?? lead.center),
    zipCode: '',
    discoveryAnswer: '',
    age: '',
    fu1D: cleanLooseText(draft.followUps?.[0]?.date ?? lead.followUps[0]?.date),
    fu1C: cleanLooseText(draft.followUps?.[0]?.comment ?? lead.followUps[0]?.comment),
    fu2D: cleanLooseText(draft.followUps?.[1]?.date ?? lead.followUps[1]?.date),
    fu2C: cleanLooseText(draft.followUps?.[1]?.comment ?? lead.followUps[1]?.comment),
    FU3D: cleanLooseText(draft.followUps?.[2]?.date ?? lead.followUps[2]?.date),
    FU3C: cleanLooseText(draft.followUps?.[2]?.comment ?? lead.followUps[2]?.comment),
    time: '',
    terms: '',
    class: '',
    fu4D: cleanLooseText(draft.followUps?.[3]?.date ?? lead.followUps[3]?.date),
    fu4C: cleanLooseText(draft.followUps?.[3]?.comment ?? lead.followUps[3]?.comment),
    size: '',
    channel: cleanLooseText(draft.channel ?? lead.channel),
  };
}

export function isOverdue(dateStr: string, status: string): boolean {
  if (!dateStr || dateStr === '-') return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return date < new Date() && status !== 'Converted' && status !== 'Lost';
}

export function isMissingFeedback(followUp: FollowUp): boolean {
  return !!followUp.date && followUp.date !== '-' && (!followUp.comment || followUp.comment === '-');
}
