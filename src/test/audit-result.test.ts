import { describe, expect, it } from 'vitest';
import { parseAuditResult } from '@/pages/Index';

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
});
