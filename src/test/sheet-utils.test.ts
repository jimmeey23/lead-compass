import { describe, expect, it } from 'vitest';
import {
  columnIndexToLetter,
  combineColumnValueRanges,
  getRequiredSalesColumnRanges,
} from '../../supabase/functions/fetch-leads/sheet-utils';

describe('fetch-leads sheet utils', () => {
  it('converts zero-based column indexes to Google Sheets letters', () => {
    expect(columnIndexToLetter(0)).toBe('A');
    expect(columnIndexToLetter(25)).toBe('Z');
    expect(columnIndexToLetter(26)).toBe('AA');
    expect(columnIndexToLetter(155)).toBe('EZ');
  });

  it('builds narrow ranges for only the sales columns needed by conversion enrichment', () => {
    const headers = [
      'Member ID',
      'Customer Name',
      'Payment Date',
      'Payment Value',
      'Payment Status',
      'Cleaned Product',
      'Cleaned Category',
      'Purchase Tag',
    ];

    expect(getRequiredSalesColumnRanges(headers)).toEqual([
      'sales!A:A',
      'sales!C:C',
      'sales!D:D',
      'sales!E:E',
      'sales!F:F',
      'sales!G:G',
      'sales!H:H',
    ]);
  });

  it('accepts Customer ID as the sales member identifier column', () => {
    const headers = [
      'Customer ID',
      'Customer Name',
      'Payment Date',
      'Payment Value',
      'Payment Status',
      'Cleaned Product',
      'Cleaned Category',
      'Purchase Tag',
    ];

    expect(getRequiredSalesColumnRanges(headers)).toEqual([
      'sales!A:A',
      'sales!C:C',
      'sales!D:D',
      'sales!E:E',
      'sales!F:F',
      'sales!G:G',
      'sales!H:H',
    ]);
  });

  it('matches sales headers that contain invisible formatting characters', () => {
    const headers = [
      '\uFEFFMember\u200B ID',
      'Payment Date',
      'Payment Value',
      'Payment Status',
      'Cleaned Product',
      'Cleaned Category',
      'Purchase Tag',
    ];

    expect(getRequiredSalesColumnRanges(headers)).toEqual([
      'sales!A:A',
      'sales!B:B',
      'sales!C:C',
      'sales!D:D',
      'sales!E:E',
      'sales!F:F',
      'sales!G:G',
    ]);
  });

  it('combines fetched column ranges back into row-shaped sheet values', () => {
    const rows = combineColumnValueRanges([
      { values: [['Member ID'], ['31756028'], ['16255629']] },
      { values: [['Payment Date'], ['2026-05-12 19:21:29']] },
      { values: [['Purchase Tag'], ['New'], ['Renewed']] },
    ]);

    expect(rows).toEqual([
      ['Member ID', 'Payment Date', 'Purchase Tag'],
      ['31756028', '2026-05-12 19:21:29', 'New'],
      ['16255629', '', 'Renewed'],
    ]);
  });
});
