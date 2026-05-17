import type { Lead } from '@/types/leads';
import { cleanLooseText, isSalesConvertedLead } from '@/lib/lead-utils';

export type JourneyStageKey = 'source' | 'newLead' | 'contacted' | 'trialScheduled' | 'trialCompleted' | 'converted';
export type JourneyBranchKey = 'noResponse' | 'trialNotAttended' | 'lost';

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
  count: number;
  percentage: number;
  previousConversionRate: number | null;
}

export interface JourneyBranch {
  key: JourneyBranchKey;
  label: string;
  fromStageKey: JourneyStageKey;
  count: number;
  percentage: number;
}

export interface JourneySource {
  label: string;
  count: number;
  percentage: number;
}

export interface JourneyInsight {
  conversionRate: number;
  trialYield: number;
  convertedLtv: number;
  topSource: JourneySource | null;
  biggestLeakage: JourneyBranch | null;
}

export interface JourneyFlowData {
  totalLeads: number;
  stages: JourneyStage[];
  branches: JourneyBranch[];
  sources: JourneySource[];
  insights: JourneyInsight;
}

const STAGE_DEFS: Array<{ key: JourneyStageKey; label: string }> = [
  { key: 'source', label: 'Source' },
  { key: 'newLead', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'trialScheduled', label: 'Trial Scheduled' },
  { key: 'trialCompleted', label: 'Trial Completed' },
  { key: 'converted', label: 'Converted' },
];

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeLeadText(lead: Lead): string {
  return [
    lead.stageName,
    lead.status,
    lead.trialStatus,
    lead.conversionStatus,
    lead.remarks,
  ].map((value) => cleanLooseText(value).toLowerCase()).join(' ');
}

function isNoResponse(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/no response/, /unresponsive/, /did not answer/, /not answering/, /call back pending/]);
}

function isTrialNotAttended(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/no show/, /not attended/, /missed trial/, /trial missed/, /did not attend/]);
}

function isLost(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/not interested/, /lost/, /dropped/, /dead/, /cancel/]);
}

function isTrialCompleted(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/trial completed/, /completed trial/, /attended trial/, /trial done/, /completed/]);
}

function isTrialScheduled(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/trial scheduled/, /trial booked/, /scheduled/, /booked/, /appointment/]);
}

function isContacted(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/contacted/, /called/, /whatsapp/, /follow up/, /follow-up/, /spoken/, /consultation/]);
}

function isNewLead(lead: Lead): boolean {
  return includesAny(normalizeLeadText(lead), [/new lead/, /fresh/, /new enquiry/, /inquiry/, /enquiry/]);
}

function getReachedStage(lead: Lead): JourneyStageKey {
  if (isSalesConvertedLead(lead)) return 'converted';
  if (isTrialCompleted(lead)) return 'trialCompleted';
  if (isTrialScheduled(lead) || isTrialNotAttended(lead)) return 'trialScheduled';
  if (isContacted(lead) || isNoResponse(lead) || isLost(lead)) return 'contacted';
  if (isNewLead(lead)) return 'newLead';
  return 'newLead';
}

function percentage(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function countByPredicate(leads: Lead[], predicate: (lead: Lead) => boolean): number {
  return leads.reduce((count, lead) => count + (predicate(lead) ? 1 : 0), 0);
}

export function buildJourneyFlow(leads: Lead[]): JourneyFlowData {
  const totalLeads = leads.length;
  const rawCounts: Record<JourneyStageKey, number> = {
    source: totalLeads,
    newLead: 0,
    contacted: 0,
    trialScheduled: 0,
    trialCompleted: 0,
    converted: 0,
  };

  const stageOrder: JourneyStageKey[] = ['source', 'newLead', 'contacted', 'trialScheduled', 'trialCompleted', 'converted'];

  for (const lead of leads) {
    const reachedStage = getReachedStage(lead);
    const reachedIndex = stageOrder.indexOf(reachedStage);
    for (const stage of stageOrder.slice(1, reachedIndex + 1)) {
      rawCounts[stage] += 1;
    }
  }

  const stages = STAGE_DEFS.map((stage, index): JourneyStage => {
    const previous = index > 0 ? rawCounts[STAGE_DEFS[index - 1].key] : 0;
    const previousDenominator = Math.max(previous, rawCounts[stage.key]);
    return {
      ...stage,
      count: rawCounts[stage.key],
      percentage: percentage(rawCounts[stage.key], totalLeads),
      previousConversionRate: index === 0 ? null : percentage(rawCounts[stage.key], previousDenominator),
    };
  });

  const branches: JourneyBranch[] = [
    { key: 'noResponse', label: 'No response', fromStageKey: 'contacted', count: countByPredicate(leads, isNoResponse), percentage: 0 },
    { key: 'trialNotAttended', label: 'Trial not attended', fromStageKey: 'trialScheduled', count: countByPredicate(leads, isTrialNotAttended), percentage: 0 },
    { key: 'lost', label: 'Lost / Not interested', fromStageKey: 'contacted', count: countByPredicate(leads, isLost), percentage: 0 },
  ].map((branch) => ({ ...branch, percentage: percentage(branch.count, totalLeads) }));

  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const source = cleanLooseText(lead.sourceName) || 'Unknown Source';
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const sources = Array.from(sourceCounts.entries())
    .map(([label, count]) => ({ label, count, percentage: percentage(count, totalLeads) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);

  const convertedLtv = leads.reduce((sum, lead) => sum + (isSalesConvertedLead(lead) ? Number(lead.ltv) || 0 : 0), 0);
  return {
    totalLeads,
    stages,
    branches,
    sources,
    insights: {
      conversionRate: percentage(rawCounts.converted, totalLeads),
      trialYield: percentage(rawCounts.converted, rawCounts.trialCompleted),
      convertedLtv,
      topSource: sources[0] ?? null,
      biggestLeakage: branches.slice().sort((a, b) => b.count - a.count)[0] ?? null,
    },
  };
}
