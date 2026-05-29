import React from "react";
import { cn } from "@/lib/utils";

interface GalleryAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  width?: number | null;
  height?: number | null;
  placeholder?: string | null;
  is_spoiler?: boolean | null;
}

interface AttachmentGalleryProps {
  attachments: GalleryAttachment[];
  /** Renders a single image attachment in fill mode inside a cell. */
  renderCell: (attachment: GalleryAttachment) => React.ReactNode;
  className?: string;
}

/**
 * Discord-style image grid for 2–4 images.
 * - 2 → 1×2 (two columns)
 * - 3 → left tall + two stacked right
 * - 4 → 2×2
 * Combined render height ~350px so the layout doesn't dominate the message.
 */
export const AttachmentGallery = React.memo(function AttachmentGallery({
  attachments,
  renderCell,
  className,
}: AttachmentGalleryProps) {
  const count = attachments.length;
  if (count < 2 || count > 4) return null;

  if (count === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-1 w-full max-w-[480px] h-[260px]", className)}>
        {attachments.map((a) => (
          <div key={a.id} className="relative overflow-hidden rounded-lg">
            {renderCell(a)}
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    const [first, second, third] = attachments;
    return (
      <div className={cn("grid grid-cols-2 gap-1 w-full max-w-[480px] h-[320px]", className)}>
        <div className="relative overflow-hidden rounded-lg row-span-2">
          {renderCell(first)}
        </div>
        <div className="relative overflow-hidden rounded-lg">{renderCell(second)}</div>
        <div className="relative overflow-hidden rounded-lg">{renderCell(third)}</div>
      </div>
    );
  }

  // count === 4
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 gap-1 w-full max-w-[480px] h-[340px]", className)}>
      {attachments.map((a) => (
        <div key={a.id} className="relative overflow-hidden rounded-lg">
          {renderCell(a)}
        </div>
      ))}
    </div>
  );
});
