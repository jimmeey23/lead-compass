import { describe, expect, it } from 'vitest';
import { getGroupedSummaryDescription } from '@/lib/summary-counts';

describe('summary count grouped descriptions', () => {
  it('includes grouped source names for sidebar summaries', () => {
    expect(getGroupedSummaryDescription('Sources', {
      label: 'Instagram / Meta',
      count: 12,
      share: 30,
      detail: 'Instagram, Meta Ads',
      groupedCount: 2,
    })).toEqual({
      countLabel: '2 sources grouped',
      detailLabel: 'Includes: Instagram, Meta Ads',
      tooltip: 'Instagram, Meta Ads',
    });
  });

  it('omits grouped copy for single stage rows', () => {
    expect(getGroupedSummaryDescription('Stages', {
      label: 'Trial Scheduled',
      count: 8,
      share: 20,
      detail: 'Trial Scheduled',
      groupedCount: 1,
    })).toBeNull();
  });
});
