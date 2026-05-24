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
