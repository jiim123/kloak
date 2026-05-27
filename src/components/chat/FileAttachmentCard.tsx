import { forwardRef, useState, useCallback } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { getFileMeta, formatFileSize } from "@/lib/fileIcons";

interface FileAttachmentCardProps {
  attachment: {
    id: string;
    file_url: string;
    file_name: string;
    file_type?: string;
    file_size?: number;
  };
}

type DownloadState = "idle" | "downloading" | "done";

export const FileAttachmentCard = forwardRef<HTMLDivElement, FileAttachmentCardProps>(
  function FileAttachmentCard({ attachment }, ref) {
    const { url: signedUrl, refresh } = useSignedUrl(attachment.file_url, { withRefresh: true });
    const { Icon, label } = getFileMeta(attachment.file_name, attachment.file_type);
    const sizeLabel = formatFileSize(attachment.file_size);
    const [state, setState] = useState<DownloadState>("idle");

    const handleDownload = useCallback(async () => {
      if (state === "downloading") return;
      const src = signedUrl ?? attachment.file_url;
      if (!src) return;

      setState("downloading");
      try {
        let res = await fetch(src, { cache: "no-store" });
        if (!res.ok && signedUrl) {
          refresh();
          res = await fetch(src, { cache: "no-store" });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = attachment.file_name || "download";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        setState("done");
        setTimeout(() => setState("idle"), 1500);
      } catch (err) {
        console.error("File download failed", err);
        toast.error("Download failed");
        setState("idle");
      }
    }, [signedUrl, attachment.file_url, attachment.file_name, state, refresh]);

    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-3 p-3 md:p-3.5",
          "rounded-[6px] border border-border/50 bg-card text-card-foreground",
          "w-full sm:max-w-[420px] transition-colors",
          "hover:border-border",
        )}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] sm:text-sm font-medium text-foreground">
            {attachment.file_name}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {label}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={state === "downloading" || !signedUrl}
          aria-label={`Download ${attachment.file_name}`}
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors disabled:cursor-wait disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {state === "downloading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "done" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  },
);
