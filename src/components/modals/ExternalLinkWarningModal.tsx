import { useMemo } from "react";
import { useUIStore } from "@/stores/uiStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open External Link?</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>This link goes to an external website.</p>
            <p className="text-destructive font-medium">
              Proceed with caution. Only continue if you trust this destination.
            </p>
            {hostname && <p className="font-medium text-foreground break-all">{hostname}</p>}
            <p className="text-xs break-all">{url}</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleContinue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
