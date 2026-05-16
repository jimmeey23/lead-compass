import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertCircle,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Flag,
  Globe,
  MapPinned,
  MessageCircleMore,
  PhoneCall,
  Sparkles,
  Target,
  UserRoundPlus,
  XCircle,
} from 'lucide-react';
import type { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { cleanLooseText } from '@/lib/lead-utils';

function getStatusMeta(status: string): { icon: LucideIcon; className: string } {
  const value = status.toLowerCase();

  if (/converted|sold|member|retained|done|completed/.test(value)) {
    return { icon: CheckCircle2, className: 'semantic-success border' };
  }

  if (/lost|not interested|dropped|dead|cancel/.test(value)) {
    return { icon: XCircle, className: 'semantic-muted border' };
  }

  if (/pending|follow|awaiting|warm|new|fresh/.test(value)) {
    return { icon: Clock3, className: 'semantic-warning border' };
  }

  return { icon: Activity, className: 'semantic-info border' };
}

function getSourceMeta(source: string): LucideIcon {
  const value = source.toLowerCase();
  if (/call|phone/.test(value)) return PhoneCall;
  if (/whatsapp|message|dm/.test(value)) return MessageCircleMore;
  if (/walk|referr|friend/.test(value)) return UserRoundPlus;
  if (/website|web|google|meta|instagram|facebook|online|ad/.test(value)) return Globe;
  return Sparkles;
}

function getStageMeta(stage: string): LucideIcon {
  const value = stage.toLowerCase();
  if (/trial scheduled|scheduled/.test(value)) return CalendarCheck2;
  if (/trial/.test(value)) return Target;
  if (/proximity|near/.test(value)) return MapPinned;
  if (/not interested|lost/.test(value)) return AlertCircle;
  if (/sold|member|converted/.test(value)) return CheckCircle2;
  return Flag;
}

function getStageTone(stage: string): string {
  const value = stage.toLowerCase();
  if (/trial scheduled|scheduled|trial/.test(value)) return 'semantic-info border';
  if (/sold|member|converted/.test(value)) return 'semantic-success border';
  if (/not interested|lost|dropped|dead|cancel/.test(value)) return 'semantic-muted border';
  if (/no response|pending|follow/.test(value)) return 'semantic-warning border';
  return 'border border-border bg-background text-foreground/80';
}

function LeadBadge({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: LucideIcon;
  className: string;
}) {
  const safeLabel = cleanLooseText(label);
  if (!safeLabel || safeLabel === '-') {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  return (
    <span
      className={cn(
        'inline-flex h-8 w-[168px] max-w-full items-center justify-center gap-1.5 rounded-md px-3 text-[10px] font-semibold shadow-sm whitespace-nowrap',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{safeLabel}</span>
    </span>
  );
}

export function LeadStatusBadge({ label, className }: { label: string; className?: string }) {
  const meta = getStatusMeta(label);
  return <LeadBadge label={label} icon={meta.icon} className={cn(meta.className, className)} />;
}

export function LeadStageBadge({ label, className }: { label: string; className?: string }) {
  return (
    <LeadBadge
      label={label}
      icon={getStageMeta(label)}
      className={cn(getStageTone(label), className)}
    />
  );
}

export function LeadSourceBadge({ label, className }: { label: string; className?: string }) {
  return (
    <LeadBadge
      label={label}
      icon={getSourceMeta(label)}
      className={cn('border border-border bg-background text-slate-700 dark:text-slate-200', className)}
    />
  );
}

const hoverFields: Array<{ label: string; getValue: (lead: Lead) => string }> = [
  { label: 'Lead ID', getValue: (lead) => lead.id },
  { label: 'Phone', getValue: (lead) => lead.phoneNumber || '—' },
  { label: 'Email', getValue: (lead) => lead.email || '—' },
  { label: 'Associate', getValue: (lead) => lead.associate || '—' },
  { label: 'Center', getValue: (lead) => lead.center || '—' },
  { label: 'Created', getValue: (lead) => lead.createdAt || '—' },
  { label: 'Stage', getValue: (lead) => lead.stageName || '—' },
  { label: 'Status', getValue: (lead) => lead.status || '—' },
  { label: 'Source', getValue: (lead) => lead.sourceName || '—' },
  { label: 'Channel', getValue: (lead) => lead.channel || '—' },
  { label: 'Type', getValue: (lead) => lead.classType || '—' },
  { label: 'LTV', getValue: (lead) => (lead.ltv > 0 ? `₹${lead.ltv.toLocaleString()}` : '—') },
];

export function LeadHoverInfo({ lead }: { lead: Lead }) {
  return (
    <div className="w-full bg-popover p-4 text-popover-foreground">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/55 px-4 py-4">
            <p className="text-base font-semibold text-foreground">{lead.fullName}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {cleanLooseText(lead.email) || cleanLooseText(lead.phoneNumber) || 'No contact details yet'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeadStatusBadge label={lead.status} className="min-w-[124px]" />
              <LeadStageBadge label={lead.stageName} className="min-w-[144px]" />
              <LeadSourceBadge label={lead.sourceName} className="min-w-[144px]" />
            </div>
          </div>

          <div className="rounded-[20px] border border-border bg-background/70 p-4 shadow-sm">
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Remarks</p>
            <p className="text-xs leading-relaxed text-foreground/80">{cleanLooseText(lead.remarks) || 'No remarks added'}</p>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-3 rounded-[20px] border border-border bg-background/70 p-4 shadow-sm">
            {hoverFields.map((field) => (
              <div key={field.label} className="min-w-0 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{field.label}</p>
                <p className="break-words text-xs leading-relaxed text-foreground/80">{field.getValue(lead)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] border border-border bg-background/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Follow Ups</p>
              <p className="text-[10px] text-muted-foreground">Planner view</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {lead.followUps.map((followUp) => (
                <div key={followUp.index} className="rounded-xl border border-border/70 bg-muted/55 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">FU {followUp.index}</span>
                    <span className="text-[11px] font-mono-data text-muted-foreground">{cleanLooseText(followUp.date) || 'Not scheduled'}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/80">{cleanLooseText(followUp.comment) || 'No feedback yet'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadIconHint({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export const LeadFieldIcons = {
  source: Building2,
  stage: CircleDashed,
};
