export type AuditDialogRenderState = 'empty' | 'loading' | 'result' | 'localPreview';

interface AuditDialogStateInput {
  hasPayload: boolean;
  hasResult: boolean;
  isAuditGenerating: boolean;
  isMutationPending: boolean;
}

export function getAuditDialogRenderState({
  hasPayload,
  hasResult,
  isAuditGenerating,
  isMutationPending,
}: AuditDialogStateInput): AuditDialogRenderState {
  if (isAuditGenerating || isMutationPending) return 'loading';
  if (hasResult) return 'result';
  if (hasPayload) return 'localPreview';
  return 'empty';
}
