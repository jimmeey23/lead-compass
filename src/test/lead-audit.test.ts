import { describe, expect, it } from 'vitest';
import { buildLeadAuditPayload } from '@/lib/lead-audit';
import type { Lead } from '@/types/leads';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: '1',
  fullName: 'Audit Lead',
  phoneNumber: '',
  email: '',
  createdAt: '2026-05-01',
  sourceId: '',
  sourceName: 'Instagram',
  memberId: '',
  convertedAt: '',
  stageId: '',
  stageName: 'Contacted',
  associate: 'Associate',
  remarks: '',
  followUps: [
    { index: 1, date: '', comment: '' },
    { index: 2, date: '', comment: '' },
    { index: 3, date: '', comment: '' },
    { index: 4, date: '', comment: '' },
  ],
  center: 'Bandra',
  classType: '',
  hostId: '',
  status: 'Active',
  channel: '',
  period: '',
  purchasesMade: 0,
  ltv: 0,
  visits: 0,
  trialStatus: '',
  conversionStatus: '',
  retentionStatus: '',
  ...overrides,
});

describe('lead audit payload', () => {
  it('limits analysis to a maximum one month window', () => {
    const payload = buildLeadAuditPayload([
      lead({ id: 'old', createdAt: '2026-03-01' }),
      lead({ id: 'recent', createdAt: '2026-05-10' }),
    ], new Date('2026-05-17T00:00:00'));

    expect(payload.analysisWindow.maxDays).toBe(31);
    expect(payload.analysisWindow.requestedLeads).toBe(2);
    expect(payload.analysisWindow.includedLeads).toBe(1);
    expect(payload.records.map((record) => record.id)).toEqual(['recent']);
  });

  it('flags active leads missing required follow ups and ignores lost leads', () => {
    const payload = buildLeadAuditPayload([
      lead({ id: 'active', fullName: 'Active Lead', createdAt: '2026-05-10' }),
      lead({ id: 'lost', fullName: 'Lost Lead', createdAt: '2026-05-10', status: 'Not Interested' }),
    ], new Date('2026-05-17T00:00:00'));

    expect(payload.deterministicIssues.filter((issue) => issue.leadId === 'active' && issue.category === 'missing_follow_up')).toHaveLength(4);
    expect(payload.deterministicIssues.some((issue) => issue.leadId === 'lost')).toBe(false);
  });

  it('flags delayed and repeated follow up comments', () => {
    const payload = buildLeadAuditPayload([
      lead({
        id: 'late-copy',
        createdAt: '2026-05-01',
        followUps: [
          { index: 1, date: '2026-05-05', comment: 'Called and no answer' },
          { index: 2, date: '2026-05-08', comment: 'Called and no answer' },
          { index: 3, date: '2026-05-11', comment: 'Called and no answer' },
          { index: 4, date: '2026-05-13', comment: 'Called and no answer' },
        ],
      }),
    ], new Date('2026-05-17T00:00:00'));

    expect(payload.deterministicIssues.some((issue) => issue.category === 'late_follow_up')).toBe(true);
    expect(payload.deterministicIssues.some((issue) => issue.category === 'copy_paste_follow_up')).toBe(true);
  });
});
