

## Problem

The thread sheet header has action buttons (pin, lock, edit, delete, close) positioned in the top-right corner. The ImageLightbox also renders controls (zoom, download, close) in the top-right. Since both use high z-index values, the sheet buttons can interfere with lightbox controls or remain clickable behind the lightbox overlay.

## Solution

**Hide the sheet's header action buttons when the lightbox is open.** Since the lightbox is a fullscreen overlay at `z-[9999]`, the simplest and most effective UX fix is to conditionally hide the thread header buttons when `threadAttachmentLightboxUrl` is set. This eliminates any collision without changing either component's z-index or layout.

## Technical Details

**File: `src/components/forum/ForumChannelArea.tsx`**

- In the thread sheet header (around line 2379), wrap the action buttons `div` with a conditional that hides them when `threadAttachmentLightboxUrl` is truthy:
  ```tsx
  <div className={cn("flex items-center gap-1", threadAttachmentLightboxUrl && "invisible")}>
  ```
- This keeps the layout stable (buttons still occupy space) but makes them non-interactive and invisible when an attachment lightbox is open. Once the lightbox closes, buttons reappear instantly.

This is a single-line class change — no structural or z-index modifications needed.

