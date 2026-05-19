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
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]">
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
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
                <p className="text-sm font-medium leading-none text-[#f3f4f7]">
                  This link goes to an external website
                </p>
                <p className="mt-2 text-xs leading-5 text-[#b8bec8]">
                  Continue only if you trust this destination.
                </p>
              </div>
            </div>

            <div className="border border-[#4a4f5a] bg-[#2f343d] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
                  Destination
                </p>
                <ExternalLink className="h-4 w-4 text-[#9ea4af]" />
              </div>
              {hostname && (
                <p className="mt-3 break-all text-sm font-medium leading-5 text-[#f3f4f7]">
                  {hostname}
                </p>
              )}
              <p className="mt-2 break-all font-mono text-xs leading-5 text-[#b8bec8]">
                {url}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
