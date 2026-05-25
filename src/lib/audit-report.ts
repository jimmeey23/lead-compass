import type { LeadAuditIssue, LeadAuditPayload } from '@/lib/lead-audit';

export type NormalizedAuditIssue = {
  category?: string;
  leadName: string;
  leadId: string;
  severity: string;
  reason: string;
  evidence: string;
  recommendedAction: string;
};

export type NormalizedAuditReport = {
  executiveSummary: string;
  keyFindings: unknown[];
  operationalPatterns: unknown[];
  associateInsights: unknown[];
  stageInsights: unknown[];
  sourceInsights: unknown[];
  riskIndicators: unknown[];
  actionPlan: unknown[];
  urgentIssues: NormalizedAuditIssue[];
  followUpTimingIssues: NormalizedAuditIssue[];
  stageDiscrepancies: NormalizedAuditIssue[];
  copyPasteSignals: NormalizedAuditIssue[];
  recommendedActions: unknown[];
  additionalInsights: Array<{ label: string; value: unknown }>;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

export function formatAuditLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

export function auditText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(auditText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return ['reason', 'summary', 'detail', 'message', 'recommendedAction']
      .map((key) => auditText(record[key]))
      .find(Boolean) ?? '';
  }
  return '';
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => record[key]).find((value) => auditText(value) || (Array.isArray(value) && value.length > 0));
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || auditText(value) === '') return [];
  return [value];
}

function normalizeIssue(item: unknown, fallbackCategory = ''): NormalizedAuditIssue {
  const record = asRecord(item);
  const category = auditText(record ? firstValue(record, ['category', 'type', 'issueType', 'area', 'section']) : '') || fallbackCategory;
  const leadId = auditText(record ? firstValue(record, ['leadId', 'lead_id', 'id']) : '');
  return {
    category,
    leadName: auditText(record ? firstValue(record, ['leadName', 'lead_name', 'lead', 'name', 'memberName']) : '') || leadId,
    leadId,
    severity: auditText(record ? firstValue(record, ['severity', 'priority', 'urgency', 'risk']) : '') || 'Review',
    reason: auditText(record ? firstValue(record, ['reason', 'finding', 'issue', 'summary', 'detail', 'message', 'concern']) : item),
    evidence: auditText(record ? firstValue(record, ['evidence', 'proof', 'signal', 'context', 'supportingDetail']) : ''),
    recommendedAction: auditText(record ? firstValue(record, ['recommendedAction', 'recommended_action', 'action', 'nextStep', 'next_step', 'resolution']) : ''),
  };
}

function issueSectionFor(issue: NormalizedAuditIssue): keyof Pick<NormalizedAuditReport, 'urgentIssues' | 'followUpTimingIssues' | 'stageDiscrepancies' | 'copyPasteSignals'> {
  const text = [issue.category, issue.reason, issue.evidence].join(' ').toLowerCase();
  if (text.includes('copy') || text.includes('paste') || text.includes('duplicate')) return 'copyPasteSignals';
  if (text.includes('stage') || text.includes('status') || text.includes('discrep')) return 'stageDiscrepancies';
  if (text.includes('follow') || text.includes('cadence') || text.includes('timing') || text.includes('overdue') || text.includes('late')) return 'followUpTimingIssues';
  return 'urgentIssues';
}

function deterministicIssueSection(issue: LeadAuditIssue): keyof Pick<NormalizedAuditReport, 'urgentIssues' | 'followUpTimingIssues' | 'stageDiscrepancies' | 'copyPasteSignals'> {
  if (issue.category === 'stage_comment_discrepancy') return 'stageDiscrepancies';
  if (issue.category === 'copy_paste_follow_up') return 'copyPasteSignals';
  if (issue.severity === 'high') return 'urgentIssues';
  return 'followUpTimingIssues';
}

function issuePriority(severity: string): number {
  const normalized = severity.toLowerCase();
  if (normalized.includes('high') || normalized.includes('urgent')) return 0;
  if (normalized.includes('medium')) return 1;
  return 2;
}

function recommendedActionForDeterministicIssue(issue: LeadAuditIssue): string {
  switch (issue.category) {
    case 'missing_follow_up':
      return 'Complete the missing follow-up entry and contact the lead according to the LR cadence.';
    case 'late_follow_up':
      return 'Contact the lead and coach the assigned associate on expected follow-up timing.';
    case 'early_follow_up':
      return 'Verify the follow-up date and correct the log if the entry was backfilled incorrectly.';
    case 'missing_welcome_message':
      return 'Add welcome message evidence or send the initial WhatsApp/DM if it was missed.';
    case 'missing_phone_call':
      return 'Log phone call evidence or place the pending call attempt.';
    case 'stage_comment_discrepancy':
      return 'Reconcile the lead stage/status with the latest contact comments before management review.';
    case 'copy_paste_follow_up':
      return 'Replace repeated notes with the actual lead-specific conversation outcome.';
    default:
      return 'Review the lead record and update the follow-up trail.';
  }
}

function deterministicIssueKey(issue: Pick<NormalizedAuditIssue, 'leadId' | 'leadName' | 'category' | 'reason' | 'evidence'>): string {
  return [
    issue.leadId,
    issue.leadName,
    issue.category,
    issue.reason,
    issue.evidence,
  ].map((value) => auditText(value).toLowerCase().trim()).join('|');
}

function normalizedIssueFromDeterministicIssue(issue: LeadAuditIssue): NormalizedAuditIssue {
  return {
    category: issue.category,
    leadName: issue.leadName || issue.leadId,
    leadId: issue.leadId,
    severity: issue.severity,
    reason: issue.detail,
    evidence: issue.evidence,
    recommendedAction: recommendedActionForDeterministicIssue(issue),
  };
}

function deterministicSummary(payload: LeadAuditPayload): string {
  const topCategories = payload.deterministicIssueBreakdown.byCategory
    .slice(0, 3)
    .map((row) => `${row.count} ${row.category.replace(/_/g, ' ')}`)
    .join(', ');
  const topLeads = payload.deterministicIssueBreakdown.topAffectedLeads
    .slice(0, 3)
    .map((lead) => `${lead.leadName} (${lead.count})`)
    .join(', ');

  return [
    `Local deterministic pre-audit found ${payload.summary.deterministicIssueCount} issue${payload.summary.deterministicIssueCount === 1 ? '' : 's'} across ${payload.analysisWindow.includedLeads} lead${payload.analysisWindow.includedLeads === 1 ? '' : 's'}.`,
    topCategories ? `Top issue categories: ${topCategories}.` : '',
    topLeads ? `Highest-impact leads: ${topLeads}.` : '',
  ].filter(Boolean).join(' ');
}

function deterministicKeyFindings(payload: LeadAuditPayload): unknown[] {
  const findings: unknown[] = [];
  const highSeverity = payload.deterministicIssueBreakdown.bySeverity.find((row) => row.severity === 'high')?.count ?? 0;
  const mediumSeverity = payload.deterministicIssueBreakdown.bySeverity.find((row) => row.severity === 'medium')?.count ?? 0;

  if (payload.summary.deterministicIssueCount > 0) {
    findings.push({
      title: 'Deterministic issue queue',
      detail: `${payload.summary.deterministicIssueCount} locally detected audit issues require review before relying on AI interpretation.`,
      evidence: `${highSeverity} high-severity and ${mediumSeverity} medium-severity issues found.`,
    });
  }

  payload.deterministicIssueBreakdown.byCategory.slice(0, 4).forEach((row) => {
    findings.push({
      title: row.category.replace(/_/g, ' '),
      detail: `${row.count} issue${row.count === 1 ? '' : 's'} detected in this category.`,
      evidence: `${row.high} high, ${row.medium} medium, ${row.low} low.`,
    });
  });

  return findings;
}

function deterministicOperationalPatterns(payload: LeadAuditPayload): unknown[] {
  return payload.deterministicIssueBreakdown.byCategory.slice(0, 5).map((row) => ({
    pattern: row.category.replace(/_/g, ' '),
    insight: `${row.count} repeated signal${row.count === 1 ? '' : 's'} found in the filtered audit window.`,
    evidence: `Severity mix: ${row.high} high / ${row.medium} medium / ${row.low} low.`,
  }));
}

function deterministicRiskIndicators(payload: LeadAuditPayload): unknown[] {
  if (payload.summary.deterministicIssueCount === 0) return [];

  return [
    {
      risk: 'Conversion leakage',
      impact: 'Missed or late early-journey follow-ups can reduce trial booking and membership conversion momentum.',
      evidence: `${payload.summary.deterministicIssueCount} local audit flags in a ${payload.analysisWindow.maxDays}-day window.`,
    },
    {
      risk: 'Management visibility',
      impact: 'Sparse or repeated comments weaken lead handoff quality and make associate coaching harder.',
      evidence: payload.deterministicIssueBreakdown.byCategory.map((row) => `${row.category}: ${row.count}`).join(', '),
    },
  ];
}

function deterministicActionPlan(payload: LeadAuditPayload): unknown[] {
  if (payload.summary.deterministicIssueCount === 0) return [];

  return [
    {
      priority: 'High',
      action: 'Work the deterministic issue queue from high severity to low severity and update each lead record with specific evidence.',
      owner: 'Studio management / Client Success',
      timeline: 'Same business day',
      successMetric: 'All high-severity deterministic audit rows are resolved or deliberately exempted.',
    },
    {
      priority: 'Medium',
      action: 'Review the top affected leads and category breakdown in associate coaching.',
      owner: 'Studio management',
      timeline: 'Next coaching cycle',
      successMetric: 'Repeat missing follow-up and copy-paste categories decline in the next audit window.',
    },
  ];
}

function deterministicRecommendedActions(payload: LeadAuditPayload): unknown[] {
  return payload.deterministicIssueBreakdown.byCategory.slice(0, 4).map((row) => ({
    action: `Resolve ${row.count} ${row.category.replace(/_/g, ' ')} issue${row.count === 1 ? '' : 's'} in the deterministic audit queue.`,
    priority: row.high > 0 ? 'High' : row.medium > 0 ? 'Medium' : 'Low',
  }));
}

function mergeUniqueIssues(existing: NormalizedAuditIssue[], additions: NormalizedAuditIssue[]): NormalizedAuditIssue[] {
  const seen = new Set(existing.map(deterministicIssueKey));
  const merged = [...existing];

  additions
    .sort((a, b) => issuePriority(a.severity) - issuePriority(b.severity))
    .forEach((issue) => {
      const key = deterministicIssueKey(issue);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(issue);
    });

  return merged.slice(0, 25);
}

export function mergeAuditReportWithDeterministicPayload(report: NormalizedAuditReport, payload?: LeadAuditPayload | null): NormalizedAuditReport {
  if (!payload || payload.summary.deterministicIssueCount === 0) return report;

  const additionsBySection = payload.deterministicIssues.reduce<Record<keyof Pick<NormalizedAuditReport, 'urgentIssues' | 'followUpTimingIssues' | 'stageDiscrepancies' | 'copyPasteSignals'>, NormalizedAuditIssue[]>>((sections, issue) => {
    sections[deterministicIssueSection(issue)].push(normalizedIssueFromDeterministicIssue(issue));
    return sections;
  }, {
    urgentIssues: [],
    followUpTimingIssues: [],
    stageDiscrepancies: [],
    copyPasteSignals: [],
  });
  const nextReport: NormalizedAuditReport = {
    ...report,
    urgentIssues: mergeUniqueIssues(report.urgentIssues, additionsBySection.urgentIssues),
    followUpTimingIssues: mergeUniqueIssues(report.followUpTimingIssues, additionsBySection.followUpTimingIssues),
    stageDiscrepancies: mergeUniqueIssues(report.stageDiscrepancies, additionsBySection.stageDiscrepancies),
    copyPasteSignals: mergeUniqueIssues(report.copyPasteSignals, additionsBySection.copyPasteSignals),
    keyFindings: [...report.keyFindings, ...deterministicKeyFindings(payload)].slice(0, 8),
    operationalPatterns: [...report.operationalPatterns, ...deterministicOperationalPatterns(payload)].slice(0, 8),
    riskIndicators: [...report.riskIndicators, ...deterministicRiskIndicators(payload)].slice(0, 8),
    actionPlan: [...report.actionPlan, ...deterministicActionPlan(payload)].slice(0, 8),
    recommendedActions: [...report.recommendedActions, ...deterministicRecommendedActions(payload)].slice(0, 10),
  };

  const localSummary = deterministicSummary(payload);
  nextReport.executiveSummary = report.executiveSummary
    ? `${localSummary} AI summary: ${report.executiveSummary}`
    : localSummary;

  return nextReport;
}

function hasRootIssueShape(record: Record<string, unknown>): boolean {
  const hasIssueText = Boolean(firstValue(record, ['reason', 'finding', 'issue', 'detail', 'message', 'concern']));
  const hasIssueMetadata = Boolean(firstValue(record, ['leadId', 'lead_id', 'leadName', 'lead_name', 'severity', 'priority', 'evidence', 'recommendedAction', 'recommended_action']));
  return hasIssueText && hasIssueMetadata;
}

function extractEmbeddedJson(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    const opener = text[start];
    if (opener !== '{' && opener !== '[') continue;

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') inString = false;
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{' || char === '[') {
        stack.push(char);
        continue;
      }

      if (char !== '}' && char !== ']') continue;

      const expectedOpener = char === '}' ? '{' : '[';
      if (stack.pop() !== expectedOpener) break;

      if (stack.length === 0) {
        const candidate = text.slice(start, index + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          break;
        }
      }
    }
  }

  return null;
}

export function parseAuditResult(result: unknown, depth = 0): unknown {
  if (depth > 6) return result;

  if (typeof result === 'object' && result !== null) {
    const record = result as Record<string, unknown>;
    if ('analysis' in record && record.analysis !== undefined) {
      return parseAuditResult(record.analysis, depth + 1);
    }
    return result;
  }

  if (typeof result !== 'string') return result;

  const trimmed = result.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const unfencedCandidate = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const directCandidate = fencedMatch?.[1]?.trim() ?? unfencedCandidate;
  const candidates = [directCandidate, extractEmbeddedJson(trimmed)].filter((candidate): candidate is string => Boolean(candidate));

  for (const jsonCandidate of candidates) {
    if (!jsonCandidate.startsWith('{') && !jsonCandidate.startsWith('[') && !jsonCandidate.startsWith('"')) continue;

    try {
      return parseAuditResult(JSON.parse(jsonCandidate), depth + 1);
    } catch {
      // Try the next candidate before falling back to raw text.
    }
  }

  return result;
}

export function normalizeAuditReport(result: unknown): NormalizedAuditReport {
  const parsed = parseAuditResult(result);
  const baseRecord = asRecord(parsed) ?? {};
  const wrapper = firstDefined(baseRecord, ['report', 'auditReport', 'audit_report', 'data', 'result']);
  const data = asRecord(wrapper) ?? baseRecord;
  const sectionKeys = ['urgentIssues', 'followUpTimingIssues', 'stageDiscrepancies', 'copyPasteSignals'];

  const report: NormalizedAuditReport = {
    executiveSummary: auditText(firstValue(data, ['executiveSummary', 'executive_summary', 'summary', 'reportSummary', 'insightSummary', 'overview'])),
    keyFindings: arrayValue(firstValue(data, ['keyFindings', 'key_findings', 'majorFindings', 'major_findings', 'findingsSummary', 'findings_summary'])),
    operationalPatterns: arrayValue(firstValue(data, ['operationalPatterns', 'operational_patterns', 'patterns', 'patternAnalysis', 'pattern_analysis'])),
    associateInsights: arrayValue(firstValue(data, ['associateInsights', 'associate_insights', 'associateAnalysis', 'associate_analysis', 'teamInsights', 'team_insights'])),
    stageInsights: arrayValue(firstValue(data, ['stageInsights', 'stage_insights', 'stageAnalysis', 'stage_analysis'])),
    sourceInsights: arrayValue(firstValue(data, ['sourceInsights', 'source_insights', 'sourceAnalysis', 'source_analysis'])),
    riskIndicators: arrayValue(firstValue(data, ['riskIndicators', 'risk_indicators', 'risks', 'riskSummary', 'risk_summary'])),
    actionPlan: arrayValue(firstValue(data, ['actionPlan', 'action_plan', 'priorityActions', 'priority_actions', 'nextSteps', 'next_steps'])),
    urgentIssues: arrayValue(firstValue(data, ['urgentIssues', 'urgent_issues', 'criticalIssues', 'highPriorityIssues']))
      .map((item) => normalizeIssue(item, 'urgent'))
      .filter((issue) => issue.reason || issue.evidence || issue.recommendedAction),
    followUpTimingIssues: arrayValue(firstValue(data, ['followUpTimingIssues', 'follow_up_timing_issues', 'followUpIssues', 'timingIssues', 'cadenceIssues']))
      .map((item) => normalizeIssue(item, 'follow-up timing'))
      .filter((issue) => issue.reason || issue.evidence || issue.recommendedAction),
    stageDiscrepancies: arrayValue(firstValue(data, ['stageDiscrepancies', 'stage_discrepancies', 'stageIssues', 'statusDiscrepancies']))
      .map((item) => normalizeIssue(item, 'stage discrepancy'))
      .filter((issue) => issue.reason || issue.evidence || issue.recommendedAction),
    copyPasteSignals: arrayValue(firstValue(data, ['copyPasteSignals', 'copy_paste_signals', 'copyPasteIssues', 'duplicateSignals']))
      .map((item) => normalizeIssue(item, 'copy-paste signal'))
      .filter((issue) => issue.reason || issue.evidence || issue.recommendedAction),
    recommendedActions: arrayValue(firstValue(data, ['recommendedActions', 'recommended_actions', 'actionPlan', 'action_plan', 'nextSteps', 'next_steps'])),
    additionalInsights: [],
  };

  arrayValue(firstValue(data, ['issues', 'findings', 'insights']))
    .map((item) => normalizeIssue(item))
    .filter((issue) => issue.reason || issue.evidence || issue.recommendedAction)
    .forEach((issue) => {
      report[issueSectionFor(issue)].push(issue);
    });

  if (hasRootIssueShape(data)) {
    const issue = normalizeIssue(data);
    report[issueSectionFor(issue)].push(issue);
  }

  report.additionalInsights = Object.entries(data)
    .filter(([key]) => ![
      ...sectionKeys,
      'urgent_issues',
      'criticalIssues',
      'highPriorityIssues',
      'follow_up_timing_issues',
      'followUpIssues',
      'timingIssues',
      'cadenceIssues',
      'stage_discrepancies',
      'stageIssues',
      'statusDiscrepancies',
      'copy_paste_signals',
      'copyPasteIssues',
      'duplicateSignals',
      'executiveSummary',
      'executive_summary',
      'summary',
      'reportSummary',
      'insightSummary',
      'overview',
      'keyFindings',
      'key_findings',
      'majorFindings',
      'major_findings',
      'findingsSummary',
      'findings_summary',
      'operationalPatterns',
      'operational_patterns',
      'patterns',
      'patternAnalysis',
      'pattern_analysis',
      'associateInsights',
      'associate_insights',
      'associateAnalysis',
      'associate_analysis',
      'teamInsights',
      'team_insights',
      'stageInsights',
      'stage_insights',
      'stageAnalysis',
      'stage_analysis',
      'sourceInsights',
      'source_insights',
      'sourceAnalysis',
      'source_analysis',
      'riskIndicators',
      'risk_indicators',
      'risks',
      'riskSummary',
      'risk_summary',
      'recommendedActions',
      'recommended_actions',
      'actionPlan',
      'action_plan',
      'priorityActions',
      'priority_actions',
      'nextSteps',
      'next_steps',
      'issues',
      'findings',
      'insights',
      'leadId',
      'lead_id',
      'leadName',
      'lead_name',
      'severity',
      'priority',
      'urgency',
      'risk',
      'reason',
      'finding',
      'issue',
      'detail',
      'message',
      'concern',
      'evidence',
      'proof',
      'signal',
      'context',
      'supportingDetail',
      'recommendedAction',
      'recommended_action',
      'action',
      'nextStep',
      'next_step',
      'resolution',
    ].includes(key))
    .filter(([, value]) => auditText(value))
    .slice(0, 8)
    .map(([key, value]) => ({ label: formatAuditLabel(key), value }));

  return report;
}
