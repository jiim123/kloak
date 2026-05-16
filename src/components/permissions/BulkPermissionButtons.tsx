import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BulkPermissionButtonsProps {
  onSet: (value: boolean | null) => void;
  label?: string;
  className?: string;
}

export const BulkPermissionButtons = ({ onSet, label = 'Set all:', className }: BulkPermissionButtonsProps) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground mr-1">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSet(null)}
        className="h-6 rounded-[3px] border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      >
        Inherit
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSet(false)}
        className="h-6 rounded-[3px] border-destructive/30 px-2 py-0.5 text-[11px] text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
      >
        Deny
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSet(true)}
        className="h-6 rounded-[3px] border-emerald-500/30 px-2 py-0.5 text-[11px] text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400"
      >
        Allow
      </Button>
    </div>
  );
};
