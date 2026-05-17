import { describe, expect, it } from 'vitest';
import { buildJourneyFlow } from '@/lib/journey-flow';
import type { Lead } from '@/types/leads';

const lead = (overrides: Partial<Lead>): Lead => ({
  id: 'lead-1',
  fullName: 'Test Lead',
  phoneNumber: '',
  email: '',
  createdAt: '2026-05-01',
  sourceId: '',
  sourceName: 'Instagram',
  memberId: '',
  convertedAt: '',
  stageId: '',
  stageName: 'New Lead',
  associate: '',
  remarks: '',
  followUps: [],
  center: '',
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

describe('journey flow', () => {
  it('counts the main journey stages and branch exits', () => {
    const result = buildJourneyFlow([
      lead({ id: 'new', stageName: 'New Lead' }),
      lead({ id: 'contacted', stageName: 'Contacted' }),
      lead({ id: 'scheduled', stageName: 'Trial Scheduled', trialStatus: 'Scheduled' }),
      lead({ id: 'completed', stageName: 'Trial Completed', trialStatus: 'Completed' }),
      lead({ id: 'converted', conversionStatus: 'Converted', convertedAt: '2026-05-12', ltv: 12000 }),
      lead({ id: 'no-response', stageName: 'No Response' }),
      lead({ id: 'missed', trialStatus: 'No Show' }),
      lead({ id: 'lost', status: 'Not Interested' }),
    ]);

    expect(result.totalLeads).toBe(8);
    expect(result.stages.map((stage) => [stage.key, stage.count])).toEqual([
      ['source', 8],
      ['newLead', 1],
      ['contacted', 1],
      ['trialScheduled', 2],
      ['trialCompleted', 1],
      ['converted', 1],
    ]);
    expect(result.branches.map((branch) => [branch.key, branch.count])).toEqual([
      ['noResponse', 1],
      ['trialNotAttended', 1],
      ['lost', 1],
    ]);
    expect(result.insights.conversionRate).toBe(12.5);
    expect(result.insights.convertedLtv).toBe(12000);
    expect(result.insights.biggestLeakage?.label).toBe('No response');
  });

  it('groups missing sources and ranks top sources by lead count', () => {
    const result = buildJourneyFlow([
      lead({ id: 'unknown', sourceName: '' }),
      lead({ id: 'insta-1', sourceName: 'Instagram' }),
      lead({ id: 'insta-2', sourceName: 'Instagram' }),
      lead({ id: 'walkin', sourceName: 'Walk-in' }),
    ]);

    expect(result.sources).toEqual([
      { label: 'Instagram', count: 2, percentage: 50 },
      { label: 'Unknown Source', count: 1, percentage: 25 },
      { label: 'Walk-in', count: 1, percentage: 25 },
    ]);
    expect(result.insights.topSource?.label).toBe('Instagram');
  });
});
