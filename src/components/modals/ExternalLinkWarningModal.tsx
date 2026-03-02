import { useMemo } from "react";
import { useUIStore } from "@/stores/uiStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

    // Open only in a new tab; keep the current tab in-app.
    window.open(url, "_blank", "noopener,noreferrer");
    handleClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open External Link?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This link goes to an external website.</p>
            <p className="text-destructive font-medium">
            Proceed with caution — only if you trust the link, as it might expose your IP or browser details to the destination site.
            </p>
            {hostname && <p className="font-medium text-foreground break-all">{hostname}</p>}
            <p className="text-xs break-all">{url}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
