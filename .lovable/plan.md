

## Channel Header: Topic Visibility and Mobile Channel Info Modal

### Changes

**1. `src/stores/uiStore.ts`** — Add `"channel-info"` to `ModalType` union (line 39, before `| null`)

**2. `src/components/chat/ChannelHeader.tsx`** — Desktop topic improvements

- Make channel name `flex-shrink-0` so it never gets pushed out
- Replace the current `<span className="truncate">` for topic with a CSS-truncated clickable element: `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, `max-width` constrained by flex layout (no hard character limit)
- Wrap the topic span in a `Popover` trigger — clicking shows the full topic in a `PopoverContent`

**3. `src/components/layout/MobileHeader.tsx`** — Make title tappable

- When viewing a server channel (`!isDMView && currentChannel`), wrap the title area in a `<button>` that calls `openModal("channel-info")`
- Import `useUIStore` (already imported) and use `openModal`

**4. New file: `src/components/chat/ChannelInfoModal.tsx`** — Mobile channel info modal

- Uses `Dialog` component, opens when `activeModal === "channel-info"`
- Reads `currentChannel` from `serverStore`
- Shows: channel icon + name, full topic/description (if any)
- Lists only **enabled** channel settings, each as a row with:
  - `CircleCheck` icon in Kloak status green: `text-[hsl(var(--kloak-online))]` (the `160 92% 39%` emerald green used for online status across all themes)
  - Setting label text
- Settings to check:
  - `is_private` → "Private Channel"
  - `is_read_only` → "Read-only"
  - `ghost_mode` → "Ghost Mode"
  - `block_links` → "Link Blocking" (+ show allowed domains if any)
  - `block_attachments` → "Attachments Disabled"
  - `disable_reactions` → "Reactions Disabled"
  - `disable_polls` → "Polls Disabled"
  - `slowmode_seconds > 0` → "Slowmode: Xs"
  - `auto_delete_seconds` → "Auto-delete: 1h/24h/7d/30d"
  - `is_nsfw` → "NSFW"

**5. `src/components/modals/index.ts`** — Export `ChannelInfoModal`

**6. `src/pages/AppLayout.tsx`** — Import and render `<ChannelInfoModal />` alongside other modals (~line 698)

