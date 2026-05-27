## Goal

Replace the raw generic-file attachment fallback in `MessageItem.tsx` with a polished Discord-style file card that matches Kloak's existing design system. Only the non-image / non-video / non-audio branch is affected — image, video, voice, and image-lightbox paths stay untouched.

## Design audit (existing tokens to reuse)

- **Surfaces:** `bg-card` with `border border-border/50` and `rounded-[6px]` (per `SettingsCard`). Hover uses `bg-secondary` / `hover:bg-muted`.
- **Spacing:** `p-3 md:p-4`, `gap-3`.
- **Typography:** filename `text-[13px] sm:text-sm font-medium text-foreground`, meta line `text-[11px] text-muted-foreground`.
- **Icon container:** rounded `rounded-md` muted tile (40px) — matches the brand's minimal terminal aesthetic.
- **Download button:** reuse `Button` `variant="ghost"` `size="icon-sm"` with `lucide-react` `Download` / `Loader2` / `Check` swap pattern (same UX as the lightbox download button we already shipped).
- **Width:** `max-w-[420px]` on `sm+`, `w-full` on mobile (`<640px`), filename `truncate` with `min-w-0` parent.

## New component: `src/components/chat/FileAttachmentCard.tsx`

Props:
```ts
{ attachment: { id, file_name, file_url, file_type, file_size } }
```

Behavior:
1. Resolve signed URL via existing `useSignedUrl(attachment.file_url, { withRefresh: true })`.
2. Pick icon + human-readable type label from a new helper `getFileMeta(fileName, mimeType)` (kept inside the same file or co-located in `src/lib/fileIcons.ts`).
3. Format size with existing inline logic, extended for B / KB / MB / GB.
4. Download button triggers a direct download via `fetch(signedUrl) → blob → object URL → anchor.click()`, with `idle | downloading | done | error` state shown by swapping `Download` ↔ `Loader2 animate-spin` ↔ `Check`, mirroring the lightbox pattern. Toast on failure (`sonner`).
5. Whole card is **not** a link (avoids opening a new tab); only the explicit download button initiates the action. The icon + text area is non-interactive.

## Icon + label map (extend `src/lib/fileIcons.ts`)

Add a sibling `getFileMeta(name, mime)` returning `{ Icon, label }`. Coverage (using existing lucide imports plus a few new ones — `FileCode`, `Presentation`, `FileAudio`, `FileVideo`, `FileType2`):

- PDF → `FileText`, "PDF Document"
- Word (doc/docx) → `FileText`, "Word Document"
- Excel / CSV (xls/xlsx/csv) → `FileSpreadsheet`, "Spreadsheet"
- PowerPoint (ppt/pptx/key) → `Presentation`, "Presentation"
- Archives (zip/rar/7z/tar/gz) → `FileArchive`, "Archive"
- Code (js/ts/tsx/jsx/py/rs/go/java/cpp/c/rb/php/sh/json/yml/toml/xml/html/css) → `FileCode`, language label ("TypeScript", "Python", …)
- Audio (mp3/wav/flac/ogg/m4a) → `FileAudio`, "Audio"
- Video (non-rendered/odd containers like mkv/avi) → `FileVideo`, "Video"
- Fonts (ttf/otf/woff/woff2) → `FileType2`, "Font"
- Plain text / md → `FileType`, "Text"
- Default → `FileIcon`, MIME subtype uppercased or "File"

Detection uses MIME first, then falls back to file extension. Extension lookup table is the authoritative source for code/font/archive specifics.

## Edit in `MessageItem.tsx`

Replace lines ~410–429 (the `// Generic file attachment` block, the `Icon`/`sizeLabel`/`<a>` render) with `<FileAttachmentCard attachment={attachment} />`. Keep the `inViewRef` wiring so the signed URL still fetches lazily when scrolled near viewport — pass `inViewRef` as a forwarded ref into the card's root `<div>`. Everything else in the file is untouched.

## Out of scope (explicitly not changing)

- Upload flow, schema, storage helpers, `attachmentEnrich.ts`, `attachmentLru.ts`, blurhash, signed-URL helper itself.
- `AttachmentGallery`, `VideoPlayer`, `AudioPlayer`, image rendering, lightbox.
- Realtime / store logic.

## Files

- **Create:** `src/components/chat/FileAttachmentCard.tsx`
- **Edit:** `src/lib/fileIcons.ts` (add `getFileMeta`)
- **Edit:** `src/components/chat/MessageItem.tsx` (swap generic-file branch only)

## Verification

After build: open a channel with a non-media attachment (pdf, zip, code file). Confirm card renders with correct icon + label + size, truncates long filenames, fills width on mobile viewport, and the download button spins → checks → resets without opening a new tab.