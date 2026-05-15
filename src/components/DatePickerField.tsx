import { format } from 'date-fns';
import { CalendarRange, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDateStr } from '@/types/leads';
import { cn } from '@/lib/utils';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DatePickerField({ label, value, onChange, className }: DatePickerFieldProps) {
  const selectedDate = parseDateStr(value) ?? undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-10 w-full justify-start rounded-xl border-border/50 bg-background/85 px-3 text-left text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:bg-background',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarRange className="mr-2 h-4 w-4 text-primary" />
            {selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'Select date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-2xl border-border/60 bg-popover p-0 shadow-elevated">
          <div className="border-b border-border/50 px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">Choose a calendar date</p>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) onChange(format(date, 'yyyy-MM-dd'));
            }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border/50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange('')}
                className="h-8 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
