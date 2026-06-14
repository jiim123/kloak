import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "kloak.report-system-announcement.v1.dismissed";

export const ReportSystemAnnouncementModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== "true");
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures; closing the modal should still work for this session.
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] overflow-hidden rounded-[8px] border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[486px]">
        <div className="overflow-hidden border-b border-border bg-gradient-to-b from-primary/12 via-primary/5 to-transparent px-6 py-8">
          <div className="mx-auto mb-5 flex justify-center text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 52 52"
              className="h-12 w-12"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M22.8,45.7v1c0,1.2-0.9,2.1-2.1,2.1h0H4.1c-1.2,0-2.1-0.9-2.1-2.1l0,0v-1c0-2.5,3-4.1,5.7-5.3 c0.1,0,0.2-0.1,0.3-0.2c0.2-0.1,0.5-0.1,0.7,0c1.1,0.7,2.4,1.1,3.8,1.1c1.3,0,2.6-0.4,3.8-1.1c0.2-0.1,0.4-0.1,0.6,0 c0.1,0,0.2,0.1,0.3,0.2C19.9,41.7,22.8,43.2,22.8,45.7z" />
              <ellipse cx="12.4" cy="33.7" rx="5.2" ry="5.7" />
              <path d="M34.8,3.2L34.8,3.2c-8.5,0-15.3,6.5-15.3,14.5c0,2.5,0.7,5,2,7.2c0.1,0.2,0.2,0.5,0.2,0.8L20,30.3 c-0.2,0.6,0.2,1.1,0.7,1.3c0.2,0.1,0.4,0.1,0.6,0l4.5-1.6c0.3-0.1,0.6-0.1,0.8,0.1c2.4,1.4,5.2,2.2,8,2.2c8.5,0,15.3-6.6,15.3-14.6 C50,9.7,43.1,3.2,34.8,3.2z M33.7,8.9h3v7l-0.3,4.6H34l-0.2-4.6V8.9z M35.2,26.2c-1.4,0-1.8-0.8-1.8-1.8c0-1,0.4-1.8,1.8-1.8 c1.4,0,1.8,0.8,1.8,1.8C37.1,25.4,36.6,26.2,35.2,26.2z" />
            </svg>
          </div>

          <DialogHeader className="mx-auto max-w-[360px] text-center">
            <DialogTitle className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
              New report system is here
            </DialogTitle>
            <DialogDescription className="pt-2 text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
              You can now report messages, profiles, and servers when something needs our attention.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[8px] border border-border bg-background/70 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Reports help keep Kloak safer and easier to use. Thanks for helping us look after the community.
          </div>

          <Button type="button" className="h-11 w-full rounded-[8px]" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
