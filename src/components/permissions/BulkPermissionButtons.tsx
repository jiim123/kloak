import { cn } from '@/lib/utils';

interface BulkPermissionButtonsProps {
  onSet: (value: boolean | null) => void;
  label?: string;
  className?: string;
}

export const BulkPermissionButtons = ({ onSet, label = 'Set all:', className }: BulkPermissionButtonsProps) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground mr-1">{label}</span>
      <button
        onClick={() => onSet(null)}
        className="text-[11px] px-2 py-0.5 rounded-md border border-border/50 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
      >
        Inherit
      </button>
      <button
        onClick={() => onSet(false)}
        className="text-[11px] px-2 py-0.5 rounded-md border border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
      >
        Deny
      </button>
      <button
        onClick={() => onSet(true)}
        className="text-[11px] px-2 py-0.5 rounded-md border border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
      >
        Allow
      </button>
    </div>
  );
};
