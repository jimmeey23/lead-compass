import { describe, expect, it } from 'vitest';
import {
  applyLeadFilters,
  buildStageCountSummary,
  buildStageBreakdown,
  enrichLeadsWithSalesConversions,
  flattenGroupedLeads,
  getDateNeutralFilters,
  isSalesConvertedLead,
  normalizeCenterName,
  normalizePersonName,
  splitFullName,
} from '@/lib/lead-utils';
import { defaultFilters } from '@/types/leads';
import type { Lead, FilterState } from '@/types/leads';

const baseLead: Lead = {
  id: '1',
  fullName: 'Roshan Adak',
  phoneNumber: '',
  email: '',
  createdAt: '16/03/26',
  sourceId: '3507',
  sourceName: 'Instagram',
  memberId: '',
  convertedAt: '',
  stageId: '',
  stageName: 'Trial Scheduled',
  associate: 'Nadiya Shaikh',
  remarks: '',
  followUps: [],
  center: 'Supreme HQ Bandra',
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
};

const salesRows = [
  ['Member ID', 'Customer Name', 'Customer Email', 'Payment Date', 'Payment Value', 'Payment Status', 'Cleaned Product', 'Cleaned Category', 'Purchase Tag'],
  ['16255629', 'Muskaan Mandhana', 'mm.mandhana@gmail.com', '2026-05-12 20:16:30', '10710', 'succeeded', 'Studio 8 Class Package', 'Class Packages', 'Renewed'],
  ['31756028', 'Vivek Singh', 'wewakemumbai@gmail.com', '2026-05-12 19:21:29', '161700', 'succeeded', 'Studio Annual Unlimited', 'Memberships', 'New'],
  ['31756028', 'Vivek Singh', 'wewakemumbai@gmail.com', '2026-06-12 19:21:29', '161700', 'succeeded', 'Studio Annual Unlimited', 'Memberships', 'Renewed'],
];

describe('lead utils', () => {
  it('normalizes centers and names', () => {
    expect(normalizeCenterName('supreme hq bandra')).toBe('Supreme Headquarters, Bandra');
    expect(normalizeCenterName('KWALITY HOUSE - KEMPS CORNER')).toBe('Kwality House, Kemps Corner');
    expect(normalizeCenterName('Kemps Corner / Kwality')).toBe('Kwality House, Kemps Corner');
    expect(normalizePersonName('Bhanu Priya Nahar Wed Sep 26 1990 00:00:00 GMT+0530 (India Standard Time)')).toBe('Bhanu Priya Nahar');
    expect(splitFullName('Bhanu Priya Nahar')).toEqual({ firstName: 'Bhanu', lastName: 'Priya Nahar' });
  });

  it('prioritizes notable stage breakdown entries', () => {
    const breakdown = buildStageBreakdown([
      baseLead,
      { ...baseLead, id: '2', stageName: 'Membership Sold' },
      { ...baseLead, id: '3', stageName: 'Not Interested' },
    ]);

    expect(breakdown.map((entry) => entry.label)).toEqual(['Trial Scheduled', 'Membership Sold', 'Not Interested']);
  });

  it('groups common stage count variants while preserving unique stage details and totals', () => {
    const summary = buildStageCountSummary([
      { ...baseLead, id: 'scheduled-1', stageName: 'Trial Scheduled' },
      { ...baseLead, id: 'scheduled-2', stageName: 'Trial Booked' },
      { ...baseLead, id: 'sold-1', stageName: 'Membership Sold' },
      { ...baseLead, id: 'sold-2', stageName: 'Converted' },
      { ...baseLead, id: 'custom', stageName: 'Needs Manager Call' },
    ]);

    expect(summary).toEqual([
      expect.objectContaining({ label: 'Membership Sold / Converted', count: 2, groupedCount: 2, detail: 'Converted, Membership Sold' }),
      expect.objectContaining({ label: 'Trial Scheduled', count: 2, groupedCount: 2, detail: 'Trial Booked, Trial Scheduled' }),
      expect.objectContaining({ label: 'Needs Manager Call', count: 1, groupedCount: 1, detail: 'Needs Manager Call' }),
    ]);
  });

  it('enriches lead conversion data from the sales sheet by member ID', () => {
    const enriched = enrichLeadsWithSalesConversions([
      { ...baseLead, id: '1', memberId: '31756028', createdAt: '2026-03-16', convertedAt: '', conversionStatus: '' },
      { ...baseLead, id: '2', memberId: '16255629', convertedAt: '', conversionStatus: '' },
    ], salesRows);

    expect(enriched[0].convertedAt).toBe('2026-05-12 19:21:29');
    expect(enriched[0].conversionStatus).toBe('Converted');
    expect(enriched[1].convertedAt).toBe('2026-05-12 20:16:30');
    expect(enriched[1].conversionStatus).toBe('Converted');
  });

  it('only considers positive non-retail non-credit sales strictly after the lead creation date', () => {
    const constrainedSalesRows = [
      ['Member ID', 'Payment Date', 'Payment Value', 'Payment Status', 'Cleaned Product', 'Cleaned Category', 'Purchase Tag'],
      ['400', '2026-03-01 10:00:00', '50000', 'succeeded', 'Studio 8 Class Package', 'Memberships', 'New'],
      ['400', '2026-03-16 00:00:00', '50000', 'succeeded', 'Studio Same Day Package', 'Memberships', 'New'],
      ['400', '2026-04-01 10:00:00', '0', 'succeeded', 'Studio 8 Class Package', 'Memberships', 'New'],
      ['400', '2026-04-02 10:00:00', '5000', 'succeeded', 'P57 Retail Bottle', 'Retail', 'New'],
      ['400', '2026-04-03 10:00:00', '5000', 'succeeded', '2 for 1 Intro Offer', 'Memberships', 'New'],
      ['400', '2026-04-04 10:00:00', '5000', 'succeeded', 'Money Credits Top-Up', 'Memberships', 'New'],
      ['400', '2026-04-05 10:00:00', '5000', 'succeeded', 'Studio 8 Class Package', 'Class Packages', 'Renewed'],
    ];

    const enriched = enrichLeadsWithSalesConversions([
      { ...baseLead, id: 'qualified', memberId: '400', createdAt: '2026-03-16', convertedAt: '', conversionStatus: '' },
    ], constrainedSalesRows);

    expect(enriched[0].convertedAt).toBe('2026-04-05 10:00:00');
    expect(enriched[0].conversionStatus).toBe('Converted');
  });

  it('clears lead-sheet conversion values when there is no qualifying sales-sheet conversion', () => {
    const disqualifiedSalesRows = [
      ['Member ID', 'Payment Date', 'Payment Value', 'Payment Status', 'Cleaned Product', 'Cleaned Category', 'Purchase Tag'],
      ['500', '2026-04-01 10:00:00', '0', 'succeeded', 'Studio 8 Class Package', 'Memberships', 'New'],
    ];

    const enriched = enrichLeadsWithSalesConversions([
      { ...baseLead, id: 'old-conversion', memberId: '500', createdAt: '2026-03-16', convertedAt: '2026-04-01 10:00:00', conversionStatus: 'Converted' },
    ], disqualifiedSalesRows);

    expect(enriched[0].convertedAt).toBe('');
    expect(enriched[0].conversionStatus).toBe('');
  });

  it('counts converted leads only from sales-enriched conversion fields, not stage labels', () => {
    const stageOnlySoldLead = {
      ...baseLead,
      id: 'stage-only-sold',
      associate: 'Akshay Rane',
      stageName: 'Membership Sold',
      convertedAt: '',
      conversionStatus: '',
    };
    const salesConvertedLead = {
      ...baseLead,
      id: 'sales-converted',
      associate: 'Akshay Rane',
      stageName: 'Trial Scheduled',
      convertedAt: '2026-05-12 19:21:29',
      conversionStatus: 'Converted',
    };

    expect(isSalesConvertedLead(stageOnlySoldLead)).toBe(false);
    expect(isSalesConvertedLead(salesConvertedLead)).toBe(true);

    const [groupRow] = flattenGroupedLeads([stageOnlySoldLead, salesConvertedLead], ['associate']);

    expect(groupRow.type).toBe('group');
    if (groupRow.type === 'group') {
      expect(groupRow.groupMetrics.converted).toBe(1);
    }
  });

  it('filters leads by separate creation and conversion date ranges', () => {
    const filters: FilterState = {
      ...defaultFilters,
      center: 'all',
      datePreset: 'custom',
      customDateFrom: '2026-03-01',
      customDateTo: '2026-03-31',
      convertedDatePreset: 'custom',
      convertedDateFrom: '2026-04-01',
      convertedDateTo: '2026-05-31',
    };

    const filtered = applyLeadFilters([
      { ...baseLead, id: 'march-may', createdAt: '2026-03-16', convertedAt: '2026-05-12 19:21:29' },
      { ...baseLead, id: 'march-june', createdAt: '2026-03-16', convertedAt: '2026-06-01 09:00:00' },
      { ...baseLead, id: 'april-may', createdAt: '2026-04-01', convertedAt: '2026-05-12 19:21:29' },
    ], filters);

    expect(filtered.map((lead) => lead.id)).toEqual(['march-may']);
  });

  it('filters lead creation ranges when lead dates use DD/MM/YY format', () => {
    const filters: FilterState = {
      ...defaultFilters,
      center: 'all',
      datePreset: 'custom',
      customDateFrom: '2026-03-01',
      customDateTo: '2026-03-31',
      convertedDatePreset: 'custom',
      convertedDateFrom: '2026-04-01',
      convertedDateTo: '2026-05-31',
    };

    const filtered = applyLeadFilters([
      { ...baseLead, id: 'march-ddmmyy', createdAt: '16/03/26', convertedAt: '2026-05-12 19:21:29' },
    ], filters);

    expect(filtered.map((lead) => lead.id)).toEqual(['march-ddmmyy']);
  });

  it('includes conversions through the end of the selected custom to date', () => {
    const filters: FilterState = {
      ...defaultFilters,
      center: 'all',
      datePreset: 'all',
      convertedDatePreset: 'custom',
      convertedDateFrom: '2026-05-31',
      convertedDateTo: '2026-05-31',
    };

    const filtered = applyLeadFilters([
      { ...baseLead, id: 'same-day', convertedAt: '2026-05-31 23:30:00' },
    ], filters);

    expect(filtered.map((lead) => lead.id)).toEqual(['same-day']);
  });

  it('can clear date filters while preserving non-date filters for date-free views', () => {
    const filters: FilterState = {
      ...defaultFilters,
      associate: 'Akshay Rane',
      center: 'Supreme Headquarters, Bandra',
      sourceName: ['Instagram'],
      datePreset: 'custom',
      customDateFrom: '2026-03-01',
      customDateTo: '2026-03-31',
      convertedDatePreset: 'custom',
      convertedDateFrom: '2026-05-01',
      convertedDateTo: '2026-05-31',
    };

    expect(getDateNeutralFilters(filters)).toEqual({
      ...filters,
      datePreset: 'all',
      customDateFrom: '',
      customDateTo: '',
      convertedDatePreset: 'all',
      convertedDateFrom: '',
      convertedDateTo: '',
    });
  });
});
