import { memo } from "react";
import { X, Plus, Loader2, FileIcon, Film, Music } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface PendingAttachment {
  file: File;
  preview: string;
  uploading?: boolean;
  /** When set, this attachment is a remote GIF URL (no file upload needed). */
  gifUrl?: string;
}

const MAX_ATTACHMENTS = 10;

interface AttachmentPreviewBarProps {
  attachments: PendingAttachment[];
  onRemove: (index: number) => void;
  onAddMore: () => void;
  disabled?: boolean;
}

export const AttachmentPreviewBar = memo(({ attachments, onRemove, onAddMore, disabled }: AttachmentPreviewBarProps) => {
  if (attachments.length === 0) return null;

  const canAddMore = attachments.length < MAX_ATTACHMENTS;

  return (
    <div className="border-t border-border/30 px-3 pt-2.5 pb-1.5">
      <div className="flex items-end gap-2 overflow-x-auto scrollbar-thin pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {attachments.map((att, index) => (
          <div key={index} className="relative group flex-shrink-0">
            {/* Thumbnail */}
            <div className="w-[68px] h-[68px] rounded-lg border border-border/50 overflow-hidden bg-muted/30 relative">
              {att.gifUrl ? (
                <img
                  src={att.preview}
                  alt="GIF"
                  className="w-full h-full object-cover"
                />
              ) : att.file.type.startsWith("image/") && att.preview ? (
                <img
                  src={att.preview}
                  alt={att.file.name}
                  className="w-full h-full object-cover"
                />
              ) : att.file.type.startsWith("video/") ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Film className="w-5 h-5 text-muted-foreground" />
                  <p className="text-[9px] text-muted-foreground truncate max-w-[60px] px-1">{att.file.name}</p>
                </div>
              ) : att.file.type.startsWith("audio/") ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Music className="w-5 h-5 text-muted-foreground" />
                  <p className="text-[9px] text-muted-foreground truncate max-w-[60px] px-1">{att.file.name}</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <FileIcon className="w-5 h-5 text-muted-foreground" />
                  <p className="text-[9px] text-muted-foreground truncate max-w-[60px] px-1">{att.file.name}</p>
                </div>
              )}

              {/* Hover filename overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-1 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden sm:block">
                <p className="text-[10px] text-white truncate text-center leading-tight">
                  {att.file.name}
                </p>
              </div>

              {/* Upload spinner overlay */}
              {att.uploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}
            </div>

            {/* Remove button */}
            {!disabled && !att.uploading && (
              <button
                onClick={() => onRemove(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-foreground" />
              </button>
            )}
          </div>
        ))}

        {/* Add more button */}
        {canAddMore && !disabled && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAddMore}
                  className="w-[68px] h-[68px] rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 flex items-center justify-center flex-shrink-0 transition-colors text-muted-foreground hover:text-primary"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add more files</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!canAddMore && !disabled && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="w-[68px] h-[68px] rounded-lg border-2 border-dashed border-border/20 flex items-center justify-center flex-shrink-0 text-muted-foreground/30 cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Maximum 10 files</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* File count */}
      <div className="flex justify-end mt-0.5">
        <span className="text-[10px] text-muted-foreground/60">{attachments.length}/{MAX_ATTACHMENTS}</span>
      </div>
    </div>
  );
});

AttachmentPreviewBar.displayName = "AttachmentPreviewBar";
