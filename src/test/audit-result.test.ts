import { describe, expect, it } from 'vitest';
import { normalizeAuditReport, parseAuditResult } from '@/lib/audit-report';

describe('audit result parsing', () => {
  it('unwraps nested analysis JSON strings returned by the edge function', () => {
    const result = parseAuditResult({
      success: true,
      model: 'deepseek-v4-flash',
      analysis: JSON.stringify({
        executiveSummary: 'Associate report summary',
        urgentIssues: [{ leadId: '4695822', severity: 'high', reason: 'Missing follow ups' }],
        followUpTimingIssues: [],
        stageDiscrepancies: [],
        copyPasteSignals: [],
        recommendedActions: ['Review follow-up cadence'],
      }),
    });

    expect(result).toMatchObject({
      executiveSummary: 'Associate report summary',
      urgentIssues: [{ leadId: '4695822', severity: 'high', reason: 'Missing follow ups' }],
    });
  });

  it('parses a double-encoded JSON analysis string', () => {
    const result = parseAuditResult(JSON.stringify(JSON.stringify({
      executiveSummary: 'Double encoded summary',
      urgentIssues: [],
      followUpTimingIssues: [],
      stageDiscrepancies: [],
      copyPasteSignals: [],
      recommendedActions: ['Use formatted report view'],
    })));

    expect(result).toMatchObject({
      executiveSummary: 'Double encoded summary',
      recommendedActions: ['Use formatted report view'],
    });
  });

  it('extracts fenced JSON when the model includes surrounding prose', () => {
    const result = parseAuditResult([
      'Here is the audit:',
      '```json',
      JSON.stringify({
        executiveSummary: 'Fenced summary',
        urgentIssues: [{ leadName: 'Test Lead', severity: 'high', reason: 'Needs review' }],
        followUpTimingIssues: [],
        stageDiscrepancies: [],
        copyPasteSignals: [],
        recommendedActions: [],
      }),
      '```',
    ].join('\n'));

    expect(result).toMatchObject({
      executiveSummary: 'Fenced summary',
      urgentIssues: [{ leadName: 'Test Lead', severity: 'high', reason: 'Needs review' }],
    });
  });

  it('extracts unfenced JSON when the provider wraps the report in prose', () => {
    const result = parseAuditResult([
      'Here is the formatted audit report:',
      JSON.stringify({
        executiveSummary: 'Unfenced summary',
        urgentIssues: [{ leadName: 'Raw JSON Lead', severity: 'high', reason: 'Displayed as JSON' }],
        followUpTimingIssues: [],
        stageDiscrepancies: [],
        copyPasteSignals: [],
        recommendedActions: ['Render as structured report'],
      }),
    ].join('\n\n'));

    expect(result).toMatchObject({
      executiveSummary: 'Unfenced summary',
      urgentIssues: [{ leadName: 'Raw JSON Lead', severity: 'high', reason: 'Displayed as JSON' }],
      recommendedActions: ['Render as structured report'],
    });
  });

  it('normalizes alternate report keys into the styled report schema', () => {
    const report = normalizeAuditReport({
      summary: 'Alternate summary',
      issues: [
        {
          category: 'follow_up_timing',
          lead: 'Sample Lead',
          priority: 'urgent',
          finding: 'Follow-up is overdue',
          proof: 'Last contact was 8 days ago',
          action: 'Call today',
        },
      ],
      actionPlan: ['Prioritize overdue leads'],
    });

    expect(report.executiveSummary).toBe('Alternate summary');
    expect(report.followUpTimingIssues).toEqual([
      {
        category: 'follow_up_timing',
        leadName: 'Sample Lead',
        leadId: '',
        severity: 'urgent',
        reason: 'Follow-up is overdue',
        evidence: 'Last contact was 8 days ago',
        recommendedAction: 'Call today',
      },
    ]);
    expect(report.recommendedActions).toEqual(['Prioritize overdue leads']);
  });

  it('normalizes nested associate reports without displaying the wrapper JSON', () => {
    const parsed = parseAuditResult({
      report: {
        executive_summary: 'Associate summary',
        urgent_issues: [
          {
            lead_name: 'Associate Lead',
            severity: 'high',
            reason: 'Needs same-day review',
          },
        ],
        recommended_actions: ['Review associate cadence'],
      },
    });

    const report = normalizeAuditReport(parsed);

    expect(report.executiveSummary).toBe('Associate summary');
    expect(report.urgentIssues).toMatchObject([
      {
        leadName: 'Associate Lead',
        severity: 'high',
        reason: 'Needs same-day review',
      },
    ]);
    expect(report.recommendedActions).toEqual(['Review associate cadence']);
  });

  it('normalizes a flat root issue object into an issue row instead of additional insights', () => {
    const report = normalizeAuditReport({
      leadId: '4771100',
      severity: 'high',
      reason: 'Missing Follow Up 1 and Follow Up 2 dates',
      evidence: "Follow Up 1 and Follow Up 2 dates are '-'",
      recommendedAction: 'Schedule and log follow-up dates immediately.',
    });

    expect(report.followUpTimingIssues).toEqual([
      {
        category: '',
        leadName: '4771100',
        leadId: '4771100',
        severity: 'high',
        reason: 'Missing Follow Up 1 and Follow Up 2 dates',
        evidence: "Follow Up 1 and Follow Up 2 dates are '-'",
        recommendedAction: 'Schedule and log follow-up dates immediately.',
      },
    ]);
    expect(report.additionalInsights).toEqual([]);
  });

  it('normalizes detailed report sections for a richer HTML report', () => {
    const report = normalizeAuditReport({
      executiveSummary: 'Follow-up compliance is weak across active leads.',
      keyFindings: [
        'Most missing follow-ups are concentrated in Follow Up 1 and Follow Up 2.',
        { title: 'Contact proof gap', detail: 'Welcome and call evidence are inconsistent.' },
      ],
      operationalPatterns: [
        { pattern: 'Early journey leakage', evidence: 'High number of active leads without first follow-up dates.', impact: 'Retention risk' },
      ],
      associateInsights: [
        { associate: 'Associate A', insight: 'Needs same-day follow-up coaching.', evidence: 'Repeated missing LR+1 entries.' },
      ],
      stageInsights: [
        { stage: 'Contacted', insight: 'Stage is not supported by call evidence.' },
      ],
      actionPlan: [
        { priority: 'High', action: 'Audit all active leads missing Follow Up 1 dates today.', owner: 'Client Success', timeline: '24 hours' },
      ],
    });

    expect(report.keyFindings).toHaveLength(2);
    expect(report.operationalPatterns).toHaveLength(1);
    expect(report.associateInsights).toHaveLength(1);
    expect(report.stageInsights).toHaveLength(1);
    expect(report.actionPlan).toHaveLength(1);
    expect(report.additionalInsights).toEqual([]);
  });
});
