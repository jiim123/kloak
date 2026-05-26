# Plan — Make all themes apply consistently

## Diagnosis

The theme system in `src/stores/uiStore.ts` exposes three themes (**Default/Gray**, **AMOLED**, **Light**) and swaps CSS variables on `<html>` (`--background`, `--card`, `--foreground`, `--border`, `--menu`, etc.). Components that consume those tokens via Tailwind classes (`bg-card`, `text-foreground`, `border-border`) re-skin automatically.

The reason some components don't change with the theme is that they use **hardcoded hex values** instead of semantic tokens — e.g. `bg-[#333842]`, `text-[#c4c8d0]`, `border-[#4a4f5a]`. Those values are locked to the dark palette and stay the same in Light/AMOLED.

A grep across `src/components` and `src/pages` finds **~339 hardcoded color literals across 24 files**.

## Files to migrate

Modals (the biggest offenders — fixed dark greys):
- `src/components/modals/JoinServerModal.tsx`
- `src/components/modals/CreateServerModal.tsx`
- `src/components/modals/ImportDiscordTemplateModal.tsx`
- `src/components/modals/SearchModal.tsx`
- `src/components/modals/CreatePollModal.tsx`
- `src/components/modals/ConfirmActionModal.tsx`
- `src/components/modals/ExternalLinkWarningModal.tsx`
- `src/components/modals/InviteModal.tsx`
- `src/components/modals/DeleteMessageModal.tsx`
- `src/components/modals/SetStatusModal.tsx`

Chat & content surfaces:
- `src/components/chat/MessageItem.tsx`
- `src/components/chat/PollMessage.tsx`
- `src/components/chat/LinkPreview.tsx`
- `src/components/chat/InviteLinkPreview.tsx`
- `src/components/media/MediaChannelArea.tsx`
- `src/components/calendar/CalendarChannelArea.tsx`
- `src/components/members/ServerMembersPage.tsx`

UI primitives & misc:
- `src/components/ui/bot-tag.tsx`
- `src/components/StatusSelector.tsx`
- `src/pages/AppLayout.tsx`
- `src/pages/Invite.tsx`
- `src/pages/UserProfile.tsx`

## Token mapping

Replace dark-grey hardcodes with the semantic tokens already defined in `src/index.css` for all three themes:

| Hardcoded role | Semantic token (Tailwind class) |
|---|---|
| Surface panel (`#333842`, `#363941`, `#2f343d`) | `bg-card` / `bg-popover` |
| Subtle surface (`#30353f`, `#2b3039`) | `bg-muted` / `bg-muted/30` |
| Borders (`#4a4f5a`, `#42464F`, `#2c3139`) | `border-border` / `border-border/60` |
| Primary text (`#f3f4f7`, `#f4f5f7`, `white`) | `text-foreground` / `text-card-foreground` |
| Secondary text (`#c4c8d0`, `#b8bec8`, `#B2B5BE`) | `text-muted-foreground` |
| Dim text (`#9ea4af`, `#767B85`) | `text-muted-foreground/70` |
| Primary CTA (`#d7dbe3`, `#f0b800`) | `bg-primary text-primary-foreground` |
| Destructive accents (`#fc6464`) | `text-destructive` |
| Input underline `border-white/80` | `border-input` |

## Intentionally preserved hardcodes (out of scope)

These stay as fixed values because they don't represent UI chrome:
- Status dots (`--kloak-online/idle/dnd/offline`) — already theme-aware via tokens, no change.
- `RoleColorPicker.tsx` swatches — fixed brand color choices users pick.
- `avatar-with-decoration.tsx` deterministic fallback colors for missing avatars.
- `bot-tag.tsx` brand colors used only for the literal BOT badge (re-evaluated; primary swap only if it reads as chrome).

## Approach

1. Work file-by-file. For each file, run a focused grep for `\[#`, then surgically replace each literal with the right token from the table above, preserving opacity modifiers (e.g. `/60`, `/30`).
2. Don't change layout, spacing, radii, animation, or component structure — only color classes.
3. After each file, spot-check both Light and AMOLED themes against the existing Default theme by reading the changed sections; the build step will catch any broken classes.
4. Skip files where the only hardcodes are the preserved cases above.

## Verification

- Run the project build to catch typos in token names.
- Manually toggle through Default → Light → AMOLED in the Appearance tab and verify the previously-stuck modals/chat surfaces re-skin.

## Out of scope

- Adding new themes or new tokens to `index.css`.
- Refactoring component structure or layout.
- Removing the AMOLED theme (a separate decision — current memory note says only Default+Light are supported, but the dropdown still ships AMOLED; flag for the user separately).
