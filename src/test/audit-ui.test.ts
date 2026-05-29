import { describe, expect, it } from 'vitest';
import { getAuditDialogRenderState } from '@/lib/audit-ui';

describe('audit dialog render state', () => {
  it('shows loading while an audit request is in flight even before a result exists', () => {
    expect(getAuditDialogRenderState({
      hasPayload: true,
      hasResult: false,
      isAuditGenerating: true,
      isMutationPending: false,
    })).toBe('loading');
  });

  it('only shows the local preview when no audit request is running', () => {
    expect(getAuditDialogRenderState({
      hasPayload: true,
      hasResult: false,
      isAuditGenerating: false,
      isMutationPending: false,
    })).toBe('localPreview');
  });
});
