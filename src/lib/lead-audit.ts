import type { FollowUp, Lead } from '@/types/leads';
import { cleanLooseText, parseFlexibleDate } from '@/lib/lead-utils';

export type LeadAuditSeverity = 'high' | 'medium' | 'low';

export interface LeadAuditIssue {
  leadId: string;
  leadName: string;
  severity: LeadAuditSeverity;
  category:
    | 'missing_follow_up'
    | 'late_follow_up'
    | 'early_follow_up'
    | 'missing_welcome_message'
    | 'missing_phone_call'
    | 'stage_comment_discrepancy'
    | 'copy_paste_follow_up';
  detail: string;
  evidence: string;
}

export interface LeadAuditRecord {
  id: string;
  name: string;
  createdAt: string;
  stageName: string;
  status: string;
  trialStatus: string;
  conversionStatus: string;
  sourceName: string;
  associate: string;
  remarks: string;
  followUps: Array<Pick<FollowUp, 'index' | 'date' | 'comment'>>;
}

export interface LeadAuditPayload {
  analysisWindow: {
    from: string;
    to: string;
    maxDays: number;
    requestedLeads: number;
    includedLeads: number;
  };
  summary: {
    activeLeads: number;
    disqualifiedOrLostLeads: number;
    deterministicIssueCount: number;
  };
  timelineGuidance: string[];
  deterministicIssues: LeadAuditIssue[];
  records: LeadAuditRecord[];
}

const MAX_ANALYSIS_DAYS = 31;
const MAX_RECORDS_FOR_AI = 80;
const MAX_ISSUES_FOR_AI = 120;

const expectedFollowUpDays: Record<number, { day: number; tolerance: number }> = {
  1: { day: 1, tolerance: 1 },
  2: { day: 3, tolerance: 1 },
  3: { day: 5, tolerance: 2 },
  4: { day: 7, tolerance: 2 },
};

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isoDate(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function normalizedLeadText(lead: Lead): string {
  return [
    lead.stageName,
    lead.status,
    lead.trialStatus,
    lead.conversionStatus,
    lead.remarks,
  ].map((value) => cleanLooseText(value).toLowerCase()).join(' ');
}

function normalizedComment(comment: string): string {
  return cleanLooseText(comment)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDisqualifiedOrLost(lead: Lead): boolean {
  return /lost|not interested|disqualified|invalid|dead|cancel|dropped/.test(normalizedLeadText(lead));
}

function hasMeaningfulDate(followUp: FollowUp): boolean {
  return Boolean(cleanLooseText(followUp.date)) && cleanLooseText(followUp.date) !== '-';
}

function hasMeaningfulComment(followUp: FollowUp): boolean {
  return Boolean(cleanLooseText(followUp.comment)) && cleanLooseText(followUp.comment) !== '-';
}

function allLeadComments(lead: Lead): string {
  return [lead.remarks, ...lead.followUps.map((followUp) => followUp.comment)]
    .map(cleanLooseText)
    .join(' ')
    .toLowerCase();
}

function buildRecord(lead: Lead): LeadAuditRecord {
  return {
    id: lead.id,
    name: lead.fullName,
    createdAt: lead.createdAt,
    stageName: lead.stageName,
    status: lead.status,
    trialStatus: lead.trialStatus,
    conversionStatus: lead.conversionStatus,
    sourceName: lead.sourceName,
    associate: lead.associate,
    remarks: cleanLooseText(lead.remarks).slice(0, 280),
    followUps: lead.followUps.map((followUp) => ({
      index: followUp.index,
      date: cleanLooseText(followUp.date),
      comment: cleanLooseText(followUp.comment).slice(0, 220),
    })),
  };
}

function addIssue(issues: LeadAuditIssue[], lead: Lead, issue: Omit<LeadAuditIssue, 'leadId' | 'leadName'>) {
  issues.push({
    leadId: lead.id,
    leadName: lead.fullName,
    ...issue,
  });
}

function detectLeadIssues(lead: Lead): LeadAuditIssue[] {
  const issues: LeadAuditIssue[] = [];
  const createdAt = parseFlexibleDate(lead.createdAt);
  const active = !isDisqualifiedOrLost(lead);
  const comments = allLeadComments(lead);

  if (!createdAt) {
    return issues;
  }

  if (active && !/welcome|intro|initial message|whatsapp|dm|message sent/.test(comments)) {
    addIssue(issues, lead, {
      severity: 'low',
      category: 'missing_welcome_message',
      detail: 'No clear welcome or initial message evidence found.',
      evidence: 'Expected roughly LR + 30 minutes.',
    });
  }

  if (active && !/call|called|phone|spoke|connected|ring/.test(comments)) {
    addIssue(issues, lead, {
      severity: 'medium',
      category: 'missing_phone_call',
      detail: 'No clear phone call evidence found.',
      evidence: 'Expected roughly LR + 2 hours.',
    });
  }

  for (const followUp of lead.followUps) {
    const expected = expectedFollowUpDays[followUp.index];
    if (!expected || !active) continue;

    if (!hasMeaningfulDate(followUp) || !hasMeaningfulComment(followUp)) {
      addIssue(issues, lead, {
        severity: followUp.index <= 2 ? 'high' : 'medium',
        category: 'missing_follow_up',
        detail: `Follow Up ${followUp.index} is missing ${!hasMeaningfulDate(followUp) ? 'a date' : 'feedback'}.`,
        evidence: `Expected around LR + ${expected.day} day${expected.day === 1 ? '' : 's'}.`,
      });
      continue;
    }

    const followUpDate = parseFlexibleDate(followUp.date);
    if (!followUpDate) continue;

    const elapsed = dayDiff(createdAt, followUpDate);
    if (elapsed > expected.day + expected.tolerance) {
      addIssue(issues, lead, {
        severity: followUp.index <= 2 ? 'high' : 'medium',
        category: 'late_follow_up',
        detail: `Follow Up ${followUp.index} happened around day ${elapsed}.`,
        evidence: `Expected around day ${expected.day}, tolerance ${expected.tolerance} day${expected.tolerance === 1 ? '' : 's'}.`,
      });
    } else if (elapsed < expected.day - expected.tolerance) {
      addIssue(issues, lead, {
        severity: 'low',
        category: 'early_follow_up',
        detail: `Follow Up ${followUp.index} happened around day ${elapsed}.`,
        evidence: `Expected around day ${expected.day}, tolerance ${expected.tolerance} day${expected.tolerance === 1 ? '' : 's'}.`,
      });
    }
  }

  const normalizedComments = lead.followUps
    .filter(hasMeaningfulComment)
    .map((followUp) => ({ index: followUp.index, normalized: normalizedComment(followUp.comment) }))
    .filter((item) => item.normalized.length >= 12);
  const repeated = normalizedComments.filter((item, _, all) => all.some((other) => other.index !== item.index && other.normalized === item.normalized));

  if (repeated.length >= 2) {
    addIssue(issues, lead, {
      severity: 'medium',
      category: 'copy_paste_follow_up',
      detail: 'Multiple follow ups use identical or near-identical comments.',
      evidence: `Repeated follow-up indexes: ${Array.from(new Set(repeated.map((item) => item.index))).join(', ')}.`,
    });
  }

  if (/trial completed|converted|sold/.test(normalizedLeadText(lead)) && /no answer|not connected|did not answer|no response/.test(comments)) {
    addIssue(issues, lead, {
      severity: 'medium',
      category: 'stage_comment_discrepancy',
      detail: 'Stage suggests progress, but comments suggest no contact or no response.',
      evidence: `Stage/status: ${lead.stageName} / ${lead.status}.`,
    });
  }

  return issues;
}

export function buildLeadAuditPayload(leads: Lead[], referenceDate = new Date()): LeadAuditPayload {
  const to = startOfDay(referenceDate);
  const from = new Date(to);
  from.setDate(to.getDate() - MAX_ANALYSIS_DAYS);

  const windowedLeads = leads
    .filter((lead) => {
      const createdAt = parseFlexibleDate(lead.createdAt);
      return createdAt ? startOfDay(createdAt) >= from && startOfDay(createdAt) <= to : false;
    })
    .sort((a, b) => {
      const aDate = parseFlexibleDate(a.createdAt)?.getTime() ?? 0;
      const bDate = parseFlexibleDate(b.createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });

  const issues = windowedLeads.flatMap(detectLeadIssues);
  const activeLeads = windowedLeads.filter((lead) => !isDisqualifiedOrLost(lead)).length;

  return {
    analysisWindow: {
      from: isoDate(from),
      to: isoDate(to),
      maxDays: MAX_ANALYSIS_DAYS,
      requestedLeads: leads.length,
      includedLeads: windowedLeads.length,
    },
    summary: {
      activeLeads,
      disqualifiedOrLostLeads: windowedLeads.length - activeLeads,
      deterministicIssueCount: issues.length,
    },
    timelineGuidance: [
      'LR + 30 minutes: welcome message or initial WhatsApp/DM',
      'LR + 2 hours: phone call attempt or connection',
      'LR + 1 day: Follow Up 1',
      'LR + 3 days: Follow Up 2',
      'LR + 5 days: Follow Up 3',
      'LR + 7 days: Follow Up 4',
      'Timeline is directional; apply reasonable operational tolerance.',
    ],
    deterministicIssues: issues.slice(0, MAX_ISSUES_FOR_AI),
    records: windowedLeads.slice(0, MAX_RECORDS_FOR_AI).map(buildRecord),
  };
}
