import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReportReasonOption = {
  value: string;
  label: string;
};

interface ReportReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  reasons: ReportReasonOption[];
  submitLabel?: string;
  onSubmit: (reason: string) => Promise<void>;
}

export const ReportReasonDialog = ({
  open,
  onOpenChange,
  title,
  description,
  reasons,
  submitLabel = "Submit report",
  onSubmit,
}: ReportReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState(reasons[0]?.value ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
    if (nextOpen) setSelectedReason(reasons[0]?.value ?? "");
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason);
      onOpenChange(false);
    } catch {
      // Callers own user-facing error toasts.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[420px] rounded-[8px] border-border bg-card p-0 text-foreground">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-5 py-4">
          {reasons.map((reason) => (
            <button
              key={reason.value}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-[6px] border px-3 py-2.5 text-left text-sm transition-colors",
                selectedReason === reason.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:bg-secondary",
              )}
              onClick={() => setSelectedReason(reason.value)}
            >
              <span>{reason.label}</span>
              <span
                className={cn(
                  "h-3 w-3 rounded-full border",
                  selectedReason === reason.value ? "border-primary bg-primary" : "border-muted-foreground/50",
                )}
              />
            </button>
          ))}
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[92px] rounded-[6px]"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 min-w-[132px] rounded-[6px]"
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
