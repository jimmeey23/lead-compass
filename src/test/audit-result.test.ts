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
});
