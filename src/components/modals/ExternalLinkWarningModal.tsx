import { useMemo } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const ExternalLinkWarningModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const isOpen = activeModal === "external-link-warning";
  const url = (modalData?.url as string | undefined) || "";

  const hostname = useMemo(() => {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }, [url]);

  const handleClose = () => {
    closeModal();
  };

  const handleContinue = () => {
    if (!url) {
      handleClose();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]">
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border bg-muted px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">
              Open External Link?
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-amber-300/20 bg-amber-400/10">
                <ShieldAlert className="h-5 w-5 text-amber-200" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none text-foreground">
                  This link goes to an external website
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Continue only if you trust this destination.
                </p>
              </div>
            </div>

            <div className="border border-border bg-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Destination
                </p>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
              {hostname && (
                <p className="mt-3 break-all text-sm font-medium leading-5 text-foreground">
                  {hostname}
                </p>
              )}
              <p className="mt-2 break-all font-mono text-xs leading-5 text-muted-foreground">
                {url}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
