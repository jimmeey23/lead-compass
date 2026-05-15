import type { FollowUp } from '@/types/leads';
import { isOverdue, isMissingFeedback } from '@/hooks/useLeadsData';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, AlertCircle, Clock3, CircleDashed } from 'lucide-react';

interface Props {
  followUps: FollowUp[];
  status: string;
  compact?: boolean;
  onQuickEdit?: (followUp: FollowUp) => void;
}

export function FollowUpTimeline({ followUps, status, compact = false, onQuickEdit }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {followUps.map((fu, i) => {
          const hasDate = !!fu.date && fu.date !== '-';
          const hasComment = !!fu.comment && fu.comment !== '-';
          const completed = hasDate && hasComment;
          const overdue = hasDate && isOverdue(fu.date, status) && !hasComment;
          const missing = isMissingFeedback(fu);

          let ringClass = 'border-slate-300/60 bg-slate-100 text-slate-400';
          let iconEl: React.ReactNode = <CircleDashed className="h-3 w-3" />;

          if (completed) {
            ringClass = 'border-blue-300/70 bg-blue-100 text-blue-700';
            iconEl = <Check className="h-3 w-3" />;
          } else if (overdue) {
            ringClass = 'border-slate-300/70 bg-slate-100 text-slate-700 animate-pulse-overdue';
            iconEl = <AlertCircle className="h-3 w-3" />;
          } else if (missing) {
            ringClass = 'border-blue-200/70 bg-blue-50 text-blue-600';
            iconEl = <Clock3 className="h-3 w-3" />;
          } else if (hasDate) {
            ringClass = 'border-blue-300/70 bg-blue-100 text-blue-700';
            iconEl = <Clock3 className="h-3 w-3" />;
          }

          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => {
                    if (!onQuickEdit) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onQuickEdit(fu);
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all hover:scale-110 ${onQuickEdit ? 'cursor-pointer' : 'cursor-default'} ${ringClass}`}
                >
                  {iconEl}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[360px] p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Follow Up {fu.index}</p>
                {hasDate ? (
                  <>
                    <p className="text-[11px] text-muted-foreground font-mono">{fu.date}</p>
                    {hasComment ? (
                      <p className="text-[11px] text-foreground leading-relaxed border-t border-border/30 pt-1.5 mt-1.5">{fu.comment}</p>
                    ) : (
                      <p className="text-[11px] text-accent-warning italic">No feedback recorded</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">Not yet scheduled</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // Full timeline with lines
  return (
    <div className="flex items-center gap-0.5">
      {followUps.map((fu, i) => {
        const hasDate = !!fu.date && fu.date !== '-';
        const hasComment = !!fu.comment && fu.comment !== '-';
        const completed = hasDate && hasComment;
        const overdue = hasDate && isOverdue(fu.date, status) && !hasComment;
        const missing = isMissingFeedback(fu);

        let dotClass = 'h-3 w-3 rounded-full flex items-center justify-center ';
        let lineClass = 'h-0.5 w-3 ';

        if (completed) {
          dotClass += 'bg-blue-950 text-blue-50';
        } else if (overdue) {
          dotClass += 'bg-accent-overdue animate-pulse-overdue';
        } else if (missing) {
          dotClass += 'bg-accent-warning';
        } else if (hasDate) {
          dotClass += 'bg-primary';
        } else {
          dotClass += 'bg-border';
        }

    lineClass += completed ? 'bg-blue-900' : 'bg-border';

        return (
          <div key={i} className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={dotClass}>
                  {completed && <Check className="h-2 w-2 text-primary-foreground" />}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[360px] p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Follow Up {fu.index}</p>
                {hasDate && <p className="text-[11px] text-muted-foreground font-mono">{fu.date}</p>}
                {hasComment && <p className="text-[11px] text-foreground leading-relaxed border-t border-border/30 pt-1.5 mt-1.5">{fu.comment}</p>}
                {!hasDate && <p className="text-[11px] text-muted-foreground italic">Not scheduled</p>}
                {hasDate && !hasComment && <p className="text-[11px] text-accent-warning italic">Missing feedback</p>}
              </TooltipContent>
            </Tooltip>
            {i < followUps.length - 1 && <div className={lineClass} />}
          </div>
        );
      })}
    </div>
  );
}
