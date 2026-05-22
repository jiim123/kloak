## Problem

`EmojiPicker.tsx` and `GifPicker.tsx` use fixed tiny pixel sizes that were tuned for the desktop popover (304px wide). On mobile they render inside a full-width Drawer, but the children keep the same small dimensions, so:

- Emoji grid is locked to `grid-cols-9` with 28x28px buttons → tap targets ~28px, way below the 44px guideline.
- Category tab icons are 24x23px → hard to hit.
- Server-selector chips below the categories are 28x28px.
- Search input is 28px tall with 11px text — and on iOS the small font triggers auto-zoom on focus.
- Footer preview bar is 36px tall with a 28x28 swatch.
- In `GifPicker`, the top tabs (Trending / Categories / Recent) are 23px tall with 11px text and 14px icons; GIF grid stays `grid-cols-3` regardless of screen width; search input is 28px / 11px.
- Both pickers reuse the same desktop styling inside the mobile Drawer with no responsive bumps.

## Goal

Keep the desktop look exactly as it is. On mobile (Drawer), enlarge tabs, search, emoji/GIF cells, server chips, and the footer preview to be comfortable for touch, and prevent iOS focus-zoom.

## Changes

### `src/components/modals/EmojiPicker.tsx`

Use `useIsMobile` (already imported) to conditionally apply mobile sizes. Strategy: add `sm:` desktop classes that match today's values, and bump mobile sizes.

1. **Category tab bar** (`~line 419-444`)
   - Row height: `h-[29px]` → `h-11 sm:h-[29px]`, gap `gap-[3px]` → `gap-1 sm:gap-[3px]`.
   - Buttons: `h-[23px] w-[24px]` → `h-10 w-10 sm:h-[23px] sm:w-[24px]`, rounded `rounded-md sm:rounded-[3px]`.
   - Icon: `h-[18px] w-[18px]` → `h-6 w-6 sm:h-[18px] sm:w-[18px]`.

2. **Server selector row** (`~line 446-478`)
   - Container `h-[30px]` → `h-12 sm:h-[30px]`, gap `gap-[4px]` → `gap-1.5 sm:gap-[4px]`.
   - Server chip: `h-[28px] w-[28px]` → `h-11 w-11 sm:h-[28px] sm:w-[28px]`, text `text-[9px]` → `text-xs sm:text-[9px]`, rounded `rounded-md sm:rounded-[5px]`.

3. **Search input** (`~line 483-507`)
   - Wrapper padding `px-2 pt-1.5 pb-1.5` → `px-3 pt-2 pb-2 sm:px-2 sm:pt-1.5 sm:pb-1.5`.
   - Input height `h-[28px]` → `h-11 sm:h-[28px]`, padding `pl-8 pr-8` → `pl-10 pr-10 sm:pl-8 sm:pr-8`, text `text-[11px]` → `text-base sm:text-[11px]` (16px on mobile prevents iOS auto-zoom).
   - Search icon: `h-[14px] w-[14px]` → `h-5 w-5 sm:h-[14px] sm:w-[14px]`, left `left-2.5` → `left-3 sm:left-2.5`.
   - Clear button: `h-[18px] w-[18px]` → `h-7 w-7 sm:h-[18px] sm:w-[18px]`, right `right-1.5` → `right-2 sm:right-1.5`; X icon `h-[14px] w-[14px]` → `h-4 w-4 sm:h-[14px] sm:w-[14px]`.

4. **Emoji grid + buttons** (`renderEmojiButton`, `~line 258-289`, and grid containers at lines 309, 338, 357, 517)
   - Button: `h-[28px] w-[28px]` → `h-11 w-11 sm:h-[28px] sm:w-[28px]`, rounded `rounded-md sm:rounded-[4px]`.
   - Emoji image / FluentEmoji: render at `28px` on mobile and `22px` on desktop. Add `useIsMobile` read in the component scope (already present) and pass `size={isMobile ? 28 : 22}` to `<FluentEmoji>`, and use `h-7 w-7 sm:h-[22px] sm:w-[22px]` on `<img>` for custom emojis.
   - Text fallback: `text-[9px]` → `text-[11px] sm:text-[9px]`.
   - Grids: `grid-cols-9 gap-[1px]` → `grid-cols-7 gap-1 sm:grid-cols-9 sm:gap-[1px]` (4 occurrences: server grid, native category grid, recent-server grid, search results grid).
   - Section headings `text-[10px]` → `text-xs sm:text-[10px]`, `mb-1.5` → `mb-2 sm:mb-1.5`.
   - Empty-state copy `text-[11px]` → `text-sm sm:text-[11px]`.
   - ScrollArea inner padding `px-2 pb-1 pt-0.5` → `px-3 pb-2 pt-1 sm:px-2 sm:pb-1 sm:pt-0.5`.

5. **Footer preview bar** (`~line 547-562`)
   - Height: `h-[36px]` → `h-14 sm:h-[36px]`, padding `px-2` → `px-3 sm:px-2`.
   - Swatch: `h-7 w-7` → `h-10 w-10 sm:h-7 sm:w-7`; preview image `h-[26px] w-[26px]` → `h-9 w-9 sm:h-[26px] sm:w-[26px]`; FluentEmoji `size={isMobile ? 32 : 24}`; placeholder icon `h-4 w-4` → `h-6 w-6 sm:h-4 sm:w-4`.
   - Label `text-[11px]` → `text-sm sm:text-[11px]`.

6. **Drawer container** (`~line 570`)
   - Bump height `h-[70vh]` → `h-[78vh]` so the larger touch targets and 7-column grid have room.

### `src/components/chat/GifPicker.tsx`

Same strategy — `useIsMobile` is already read and threaded as `contentProps.isMobile`. Use it to switch class sets in `GifPickerContent`.

1. **Tab bar** (`~line 113-141`)
   - Row height `h-[29px]` → `h-12 sm:h-[29px]`, padding `px-1.5 py-1` → `px-2 py-1.5 sm:px-1.5 sm:py-1`, gap `gap-[3px]` → `gap-1 sm:gap-[3px]`.
   - Button: `h-[23px]` → `h-10 sm:h-[23px]`, text `text-[11px]` → `text-sm sm:text-[11px]`, padding `px-2` → `px-3 sm:px-2`, gap `gap-1.5` → `gap-2 sm:gap-1.5`, rounded `rounded-md sm:rounded-[3px]`.
   - Icon: `h-[14px] w-[14px]` → `h-5 w-5 sm:h-[14px] sm:w-[14px]`.

2. **Search bar** (`~line 144-167`)
   - Wrapper padding `px-2 pb-1.5 pt-1.5` → `px-3 pb-2 pt-2 sm:px-2 sm:pb-1.5 sm:pt-1.5`.
   - Input height/text/padding mirrors the EmojiPicker change above (`h-11 sm:h-[28px]`, `text-base sm:text-[11px]`, `pl-10 pr-10 sm:pl-8 sm:pr-8`).
   - Search icon and clear button bumped to the same mobile sizes as EmojiPicker.

3. **GIF & category grid** (`~line 99-117`, `~line 196-227`)
   - `grid-cols-3` stays (3 cols works on both), but `gap-1.5` → `gap-2 sm:gap-1.5`.
   - Buttons gain `rounded-md sm:rounded-[4px]`; ring focus stays as-is.
   - Category tiles: height `h-20` → `h-28 sm:h-20`, label `text-sm` → `text-base sm:text-sm`.
   - "Back to categories" pill: `text-[11px]` → `text-sm sm:text-[11px]`, icon `h-[14px] w-[14px]` → `h-5 w-5 sm:h-[14px] sm:w-[14px]`, `gap-1.5` → `gap-2 sm:gap-1.5`, `mb-2` → `mb-3 sm:mb-2`.
   - Empty states: icon `w-8 h-8` → `w-12 h-12 sm:w-8 sm:h-8`, title `text-sm` → `text-base sm:text-sm`, subtitle `text-xs` → `text-sm sm:text-xs`.
   - ScrollArea content padding `px-2 pb-1 pt-0.5` → `px-3 pb-2 pt-1 sm:px-2 sm:pb-1 sm:pt-0.5`.

4. **Klipy attribution footer** (`~line 244-254`)
   - Height `h-[36px]` → `h-12 sm:h-[36px]`, logo `h-4` → `h-5 sm:h-4`.

5. **Drawer container** (`~line 397`)
   - Bump `h-[70vh]` → `h-[78vh]` to match EmojiPicker.

## Validation

- Open both pickers on mobile preview (390px wide): tabs, search, emoji/GIF cells, server chips, and footer measure ≥44px on the touch axis.
- Desktop popover at 304px is visually unchanged (all `sm:` overrides restore today's pixel values).
- Tapping the search input on iOS does not zoom (16px font on mobile).
- 7-column emoji grid still fits within the Drawer width without horizontal overflow.

No DB, store, or behavior changes. Pure presentation / responsive sizing.