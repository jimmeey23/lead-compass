import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadAuditPayload } from '@/lib/lead-audit';

export interface LeadAuditResult {
  success: boolean;
  model?: string;
  usage?: unknown;
  analysis?: unknown;
  error?: unknown;
}

async function analyzeLeads(payload: LeadAuditPayload): Promise<LeadAuditResult> {
  const { data, error } = await supabase.functions.invoke('analyze-leads', {
    body: { payload },
  });

  if (error) throw error;
  return data as LeadAuditResult;
}

export function useLeadAudit() {
  return useMutation({
    mutationFn: analyzeLeads,
  });
}
