import { useState, useCallback } from "react";
import { secureUpload } from "@/lib/storageUpload";
import { compressAttachmentImage } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";
import { showWarning } from "@/lib/errorHandler";
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE, ALLOWED_ATTACHMENT_TYPES } from "@/lib/messageConstants";

export interface PendingAttachment {
  file: File;
  preview: string;
  uploading?: boolean;
}

interface UseAttachmentQueueOptions {
  maxAttachments?: number;
  maxFileSize?: number;
  allowedTypes?: readonly string[];
}

interface UseAttachmentQueueReturn {
  pendingAttachments: PendingAttachment[];
  addFilesToQueue: (files: File[]) => void;
  removeAttachment: (index: number) => void;
  uploadAttachments: (userId: string) => Promise<string[]>;
  clearAttachments: () => void;
}

/**
 * Hook for managing file attachment queue with upload functionality
 * Used in MessageInput and DMMessageInput
 *
 * @param options - Configuration options
 * @param options.maxAttachments - Maximum number of attachments allowed (default: 10)
 * @param options.maxFileSize - Maximum file size in bytes (default: 1MB)
 * @param options.allowedTypes - Allowed MIME types (default: image types)
 * @returns Object with attachment queue state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   pendingAttachments,
 *   addFilesToQueue,
 *   removeAttachment,
 *   uploadAttachments,
 *   clearAttachments
 * } = useAttachmentQueue();
 *
 * // Add files from input
 * <input
 *   type="file"
 *   multiple
 *   onChange={(e) => addFilesToQueue(Array.from(e.target.files))}
 * />
 *
 * // Upload before sending message
 * const urls = await uploadAttachments(user.id);
 * ```
 */
export function useAttachmentQueue(
  options: UseAttachmentQueueOptions = {}
): UseAttachmentQueueReturn {
  const {
    maxAttachments = MAX_ATTACHMENTS,
    maxFileSize = MAX_IMAGE_FILE_SIZE,
    allowedTypes = ALLOWED_IMAGE_TYPES,
  } = options;

  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);

  const addFilesToQueue = useCallback(
    (files: File[]) => {
      setPendingAttachments((prev) => {
        const remaining = maxAttachments - prev.length;
        if (remaining <= 0) {
          showWarning(
            "Attachment Limit",
            `Maximum ${maxAttachments} attachments allowed.`
          );
          return prev;
        }

        const filesToAdd = files.slice(0, remaining);
        const validFiles: PendingAttachment[] = [];

        for (const file of filesToAdd) {
          // Validate file type
          if (!allowedTypes.includes(file.type)) {
            showWarning(
              "Invalid File Type",
              `${file.name} is not a supported file type.`
            );
            continue;
          }

          // Validate file size
          if (file.size > maxFileSize) {
            const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(1);
            showWarning(
              "File Too Large",
              `${file.name} exceeds ${sizeMB}MB limit.`
            );
            continue;
          }

          validFiles.push({
            file,
            preview: URL.createObjectURL(file),
            uploading: false,
          });
        }

        return [...prev, ...validFiles];
      });
    },
    [maxAttachments, maxFileSize, allowedTypes]
  );

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      // Clean up preview URL to prevent memory leaks
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  }, []);

  const uploadAttachments = useCallback(
    async (userId: string): Promise<string[]> => {
      if (!userId || pendingAttachments.length === 0) return [];

      // Mark all as uploading
      setPendingAttachments((prev) =>
        prev.map((a) => ({ ...a, uploading: true }))
      );

      const urls: string[] = [];
      for (const att of pendingAttachments) {
        const timestamp = Date.now();
        const fileExt = att.file.name.split(".").pop() || "png";
        const fileName = `${userId}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

        const result = await secureUpload("attachments", fileName, att.file, {
          contentType: att.file.type || "application/octet-stream",
          upsert: false,
        });

        urls.push(result.publicUrl);
      }
      return urls;
    },
    [pendingAttachments]
  );

  const clearAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      // Clean up all preview URLs to prevent memory leaks
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
  }, []);

  return {
    pendingAttachments,
    addFilesToQueue,
    removeAttachment,
    uploadAttachments,
    clearAttachments,
  };
}
