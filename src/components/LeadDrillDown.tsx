import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, MessageSquare, ArrowRight, Save, RotateCcw, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';
import type { Lead, AssociateStats } from '@/types/leads';
import type { LeadOptionSets } from '@/types/leads';
import { FollowUpTimeline } from './FollowUpTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSourceIdMap, normalizeCenterName, normalizePersonName } from '@/lib/lead-utils';
import { buildMomencePayload, useUpdateLead } from '@/hooks/useLeadsData';
import { toast } from '@/components/ui/sonner';

interface Props {
  lead: Lead;
  allLeads: Lead[];
  options: LeadOptionSets;
  associateStats?: AssociateStats;
  fullscreen?: boolean;
  onClose: () => void;
}

export function LeadDrillDown({ lead, allLeads, options, associateStats, fullscreen = false, onClose }: Props) {
  const [draft, setDraft] = useState<Lead>(lead);
  const updateLead = useUpdateLead();
  const conversionPath = [draft.sourceName, draft.stageName, draft.conversionStatus].filter(Boolean);

  useEffect(() => {
    setDraft(lead);
  }, [lead]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sourceIdMap = useMemo(() => buildSourceIdMap(allLeads), [allLeads]);
  const stageIdMap = useMemo(() => {
    return allLeads.reduce<Record<string, string>>((acc, item) => {
      if (item.stageName && item.stageId) {
        acc[item.stageName] = item.stageId;
      }
      return acc;
    }, {});
  }, [allLeads]);

  const setField = <K extends keyof Lead>(key: K, value: Lead[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setFollowUpField = (index: number, key: 'date' | 'comment', value: string) => {
    setDraft((current) => ({
      ...current,
      followUps: current.followUps.map((followUp) =>
        followUp.index === index ? { ...followUp, [key]: value } : followUp,
      ),
    }));
  };

  const resetDraft = () => setDraft(lead);
  const hasUnsavedChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(lead), [draft, lead]);

  const handleSave = async () => {
    const mappedSourceId = sourceIdMap[draft.sourceName];
    const fallbackSourceId = Number(draft.sourceId || lead.sourceId || 0);
    const resolvedSourceId = Number.isFinite(mappedSourceId)
      ? mappedSourceId
      : (Number.isFinite(fallbackSourceId) ? fallbackSourceId : 0);
    const resolvedStageId = draft.stageName === lead.stageName
      ? (draft.stageId || lead.stageId)
      : (stageIdMap[draft.stageName] ?? draft.stageId);

    if (!resolvedSourceId) {
      toast.error('Missing source mapping', {
        description: 'Please choose a source that already exists in the imported lead data so the correct sourceId can be sent to Momence.',
      });
      return;
    }

    if (draft.stageName !== lead.stageName && !resolvedStageId) {
      toast.error('Missing stage mapping', {
        description: 'This stage does not yet have a known stageId in the imported data, so it cannot be updated safely.',
      });
      return;
    }

    try {
      await updateLead.mutateAsync({
        leadId: lead.id,
        payload: buildMomencePayload(
          { ...lead, sourceId: String(resolvedSourceId), stageId: String(resolvedStageId ?? '') },
          { ...draft, sourceId: String(resolvedSourceId), stageId: String(resolvedStageId ?? '') },
        ),
      });

      toast.success('Lead updated in Momence', {
        description: `${normalizePersonName(draft.fullName)} has been synced successfully.`,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'An unexpected error occurred while saving this lead.';
      toast.error('Unable to save lead', { description });
    }
  };

  const content = (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-[140] h-screen w-full overflow-y-auto border-l border-border bg-background shadow-elevated md:w-[640px]"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 dashboard-header-panel p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{draft.fullName}</h2>
            <p className="mt-0.5 font-mono text-sm text-slate-200">ID: {lead.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDraft}
              disabled={!hasUnsavedChanges || updateLead.isPending}
              className="h-8 rounded-xl px-2.5 text-white hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || updateLead.isPending}
              className="h-8 rounded-xl border border-white/20 bg-white text-slate-950 hover:bg-white/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-1.5" /> {updateLead.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 rounded-xl p-0 text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button size="sm" className="gap-1.5 rounded-xl border border-white/10 bg-white/10 text-xs text-white hover:bg-white/15">
            <Phone className="h-3.5 w-3.5" /> Call
          </Button>
          <Button size="sm" className="gap-1.5 rounded-xl border border-white/10 bg-white/10 text-xs text-white hover:bg-white/15">
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button size="sm" className="gap-1.5 rounded-xl border border-white/10 bg-white/10 text-xs text-white hover:bg-white/15">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </Button>
        </div>
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <HeaderChip label="Stage" value={draft.stageName || 'Unassigned'} variant="stage" />
            <HeaderChip label="Status" value={draft.status || 'No status'} variant="status" />
            <HeaderChip label="Trial" value={draft.trialStatus || 'No trial status'} variant="neutral" />
            <HeaderChip label="Conversion" value={draft.conversionStatus || 'Not converted'} variant={draft.conversionStatus ? 'success' : 'neutral'} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Follow-ups</span>
              <FollowUpTimeline followUps={draft.followUps} status={draft.status} compact />
            </div>
            <CompletionPill lead={draft} />
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-background p-5">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {[draft.status, draft.stageName, draft.sourceName, draft.conversionStatus].filter(Boolean).map((label) => (
            <span key={label} className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground">
              {label}
            </span>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="LTV" value={`₹${lead.ltv.toLocaleString()}`} highlight={lead.ltv > 0} />
          <MetricCard label="Visits" value={String(lead.visits)} />
          <MetricCard label="Purchases" value={String(lead.purchasesMade)} />
        </div>

        {/* Conversion Path */}
        <Section title="Conversion Path">
          <div className="flex items-center gap-2 flex-wrap">
            {conversionPath.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="rounded-xl border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground">{step}</span>
                {i < conversionPath.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Editable lead fields">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Identity</p>
                <div className="grid grid-cols-1 gap-3">
                  <FormField label="Full name">
                    <Input value={draft.fullName} onChange={(event) => setField('fullName', event.target.value)} />
                  </FormField>
                  <FormField label="Phone number">
                    <Input value={draft.phoneNumber} onChange={(event) => setField('phoneNumber', event.target.value)} />
                  </FormField>
                  <FormField label="Email">
                    <Input value={draft.email} onChange={(event) => setField('email', event.target.value)} />
                  </FormField>
                  <FormField label="Created date">
                    <Input value={draft.createdAt} onChange={(event) => setField('createdAt', event.target.value)} />
                  </FormField>
                  <FormField label="Associate">
                    <SelectField value={draft.associate} options={options.associates} onChange={(value) => setField('associate', value)} />
                  </FormField>
                  <FormField label="Center">
                    <SelectField value={draft.center} options={options.centers} onChange={(value) => setField('center', value)} />
                  </FormField>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pipeline</p>
                <div className="grid grid-cols-1 gap-3">
                  <FormField label="Source">
                    <SelectField value={draft.sourceName} options={options.sourceNames} onChange={(value) => setField('sourceName', value)} />
                  </FormField>
                  <FormField label="Stage">
                    <SelectField value={draft.stageName} options={options.stageNames} onChange={(value) => setField('stageName', value)} />
                  </FormField>
                  <FormField label="Status">
                    <SelectField value={draft.status} options={options.statuses} onChange={(value) => setField('status', value)} />
                  </FormField>
                  <FormField label="Channel">
                    <SelectField value={draft.channel} options={options.channels} onChange={(value) => setField('channel', value)} />
                  </FormField>
                  <FormField label="Type">
                    <Input value={draft.classType} onChange={(event) => setField('classType', event.target.value)} />
                  </FormField>
                  <FormField label="Conversion status">
                    <SelectField value={draft.conversionStatus} options={options.conversionStatuses} onChange={(value) => setField('conversionStatus', value)} />
                  </FormField>
                  <FormField label="Trial status">
                    <SelectField value={draft.trialStatus} options={options.trialStatuses} onChange={(value) => setField('trialStatus', value)} />
                  </FormField>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <FormField label="Remarks">
                <textarea
                  value={draft.remarks}
                  onChange={(event) => setField('remarks', event.target.value)}
                  className="min-h-[110px] w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                />
              </FormField>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Follow-up planner</p>
                <p className="text-[11px] text-muted-foreground">Grid layout</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {draft.followUps.map((followUp) => (
                  <div key={followUp.index} className="rounded-2xl border border-border bg-background/65 p-3 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">FU {followUp.index}</span>
                      <span className="text-[10px] text-muted-foreground">Schedule + notes</span>
                    </div>
                    <div className="space-y-3">
                      <Input value={followUp.date} onChange={(event) => setFollowUpField(followUp.index, 'date', event.target.value)} placeholder={`FU ${followUp.index} date`} />
                      <Input value={followUp.comment} onChange={(event) => setFollowUpField(followUp.index, 'comment', event.target.value)} placeholder={`FU ${followUp.index} comment`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetDraft} disabled={!hasUnsavedChanges || updateLead.isPending} className="rounded-xl border-border bg-background/80 text-foreground hover:bg-muted disabled:opacity-50">
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reset changes
              </Button>
              <Button type="button" onClick={handleSave} disabled={!hasUnsavedChanges || updateLead.isPending} className="rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-4 w-4" /> {updateLead.isPending ? 'Saving…' : 'Save to Momence'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Saves are sent securely through the backend using the configured <code>MOMENCE_ALL_COOKIES</code> secret. Source IDs are resolved from imported lead data, and stage IDs are used when available.
            </p>
          </div>
        </Section>

        {/* Contact Info */}
        <Section title="Contact Details">
          <div className="space-y-0">
            <InfoRow label="Phone" value={draft.phoneNumber} mono />
            <InfoRow label="Email" value={draft.email} />
            <InfoRow label="Center" value={normalizeCenterName(draft.center)} />
            <InfoRow label="Class Type" value={draft.classType} />
            <InfoRow label="Channel" value={draft.channel} />
            <InfoRow label="Associate" value={draft.associate} />
            <InfoRow label="Source" value={draft.sourceName} />
            <InfoRow label="Created" value={draft.createdAt} mono />
            {draft.convertedAt && draft.convertedAt !== '-' && (
              <InfoRow label="Converted" value={draft.convertedAt} mono />
            )}
          </div>
        </Section>

        {/* Remarks */}
        <Section title="Remarks">
          <p className={`rounded-xl border p-3.5 text-sm leading-relaxed ${
            !draft.remarks || draft.remarks === '-'
              ? 'border-border bg-muted/55 italic text-muted-foreground'
              : 'border-border bg-card/80 text-foreground'
          }`}>
            {draft.remarks && draft.remarks !== '-' ? draft.remarks : 'No remarks added'}
          </p>
        </Section>

        {/* Follow-up Timeline */}
        <Section title="Follow-up History">
          <div className="mb-4">
            <FollowUpTimeline followUps={draft.followUps} status={draft.status} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {draft.followUps.map((fu) => {
              const hasDate = !!fu.date && fu.date !== '-';
              const hasComment = !!fu.comment && fu.comment !== '-';
              return (
                <div key={fu.index} className={`rounded-xl border p-3.5 text-sm ${
                  !hasDate ? 'border-border bg-muted/55 text-muted-foreground' :
                  !hasComment ? 'border-border bg-card/80' :
                  'border-border bg-card/80'
                }`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-foreground text-xs">Follow Up {fu.index}</span>
                    {hasDate && <span className="font-mono text-[11px] text-muted-foreground">{fu.date}</span>}
                  </div>
                  <p className={`text-xs leading-relaxed ${!hasComment && hasDate ? 'italic text-muted-foreground' : 'text-muted-foreground'}`}>
                    {hasComment ? fu.comment : hasDate ? 'Missing feedback' : 'Not scheduled'}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Associate Benchmark */}
        {associateStats && (
          <Section title="Associate Performance">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricCard label="Total Leads" value={String(associateStats.totalLeads)} />
              <MetricCard label="Conv. Rate" value={`${associateStats.conversionRate.toFixed(1)}%`} highlight={associateStats.conversionRate > 20} />
              <MetricCard label="Close Rate" value={`${associateStats.closeRate.toFixed(1)}%`} highlight={associateStats.closeRate > 25} />
              <MetricCard label="Avg Follow-ups" value={associateStats.avgFollowUps.toFixed(1)} />
              <MetricCard label="Scheduled FUs" value={String(associateStats.scheduledFollowUps)} />
              <MetricCard label="Avg Visits" value={associateStats.avgVisits.toFixed(1)} />
              <MetricCard label="Avg LTV" value={`₹${associateStats.avgLtv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <MetricCard label="Centers" value={String(associateStats.centersCovered)} />
              <MetricCard label="Overdue" value={String(associateStats.overdueFollowUps)} highlight={associateStats.overdueFollowUps > 0} highlightDestructive />
            </div>
          </Section>
        )}
      </div>
    </motion.div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
}

function HeaderChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'stage' | 'status' | 'success' | 'neutral';
}) {
  const className = {
    stage: 'border-rose-200/30 bg-rose-50/15 text-white',
    status: 'border-sky-200/30 bg-sky-50/15 text-white',
    success: 'border-emerald-200/30 bg-emerald-50/15 text-white',
    neutral: 'border-white/15 bg-white/10 text-slate-100',
  }[variant];

  return (
    <span className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${className}`}>
      <span className="shrink-0 font-semibold uppercase tracking-[0.16em] text-[9px] text-slate-300">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </span>
  );
}

function CompletionPill({ lead }: { lead: Lead }) {
  const converted = Boolean(lead.conversionStatus || lead.convertedAt);
  const trialDone = /completed|attended|done/i.test(`${lead.trialStatus} ${lead.stageName}`);
  const hasOpenFollowUp = lead.followUps.some((followUp) => followUp.date && followUp.date !== '-' && (!followUp.comment || followUp.comment === '-'));

  if (converted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/30 bg-emerald-50/15 px-3 py-1.5 text-xs font-semibold text-white">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" /> Converted
      </span>
    );
  }

  if (trialDone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-50/15 px-3 py-1.5 text-xs font-semibold text-white">
        <CheckCircle2 className="h-3.5 w-3.5 text-amber-200" /> Trial completed
      </span>
    );
  }

  if (hasOpenFollowUp) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/30 bg-sky-50/15 px-3 py-1.5 text-xs font-semibold text-white">
        <Clock3 className="h-3.5 w-3.5 text-sky-200" /> Follow-up pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
      <CircleDashed className="h-3.5 w-3.5 text-slate-200" /> In progress
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lux-panel overflow-hidden rounded-2xl">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function MetricCard({ label, value, highlight, highlightDestructive }: { label: string; value: string; highlight?: boolean; highlightDestructive?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? 'border-primary/40 bg-primary/20 text-foreground' : 'border-border bg-card/80'}`}>
      <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{label}</p>
      <p className="font-mono text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SelectField({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const uniqueOptions = useMemo(() => Array.from(new Set([value, ...options].filter(Boolean))), [options, value]);

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
    >
      {uniqueOptions.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}
