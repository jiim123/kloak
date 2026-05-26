## Plan — Rename AMOLED → Dark, keep all three themes, verify theme coverage

### Scope
Keep the three existing themes (Gray "Default", AMOLED, Light). Rename AMOLED's user-facing label to **"Dark"** everywhere it appears, and audit remaining components so the rename + theme switching applies cleanly across the whole app.

### Changes

**1. `src/stores/uiStore.ts`** — rename the THEMES entry only (keep the `amoled` id to avoid breaking persisted user prefs):
- `{ id: "amoled", name: "Dark", description: "Pure black theme for OLED displays" }`
- Update the internal comment "Reset removed themes to AMOLED" → "Reset removed themes to Dark".
- Leave `theme: "amoled"` default, `cycleTheme`, `toggleTheme`, and the `applyTheme` class logic untouched (they key off the id, not the label).

**2. `public/theme-init.js`** — accept `amoled` as a valid theme so the pre-paint script doesn't reset Dark-theme users to default:
- Allow `default | amoled | light` in the validation check; remove the "removed themes" fallback comment.

**3. `src/index.css`** — no rename needed (selectors use `.amoled`), but verify the `.amoled` block is complete and no stray hardcoded greys leak through. No structural changes.

**4. Coverage audit (apply theme everywhere)** — repeat the previous semantic-token sweep on files not covered in the last pass. Targeted grep for `\[#`, `bg-white`, `bg-black`, `text-white`, `text-black`, and `rgb(` across:
   - `src/components/layout/*` (ChatArea, ChannelSidebar, ServerSidebar, MembersSidebar, MobileHeader, MobileSidebar, NavigationMenu, LoggedInUserPanel, ServerOverviewView, AlphaNoticeBanner, VoiceConnectedBanner)
   - `src/components/chat/*` (ChannelHeader, ChannelInfoModal, MessageList, MessageContent, MessageInput, FormatToolbar, GifPicker, CustomEmojiPopover, AttachmentPreviewBar, AudioPlayer, VideoPlayer, JumpToPresent, TypingIndicator, MentionAutocomplete, RoleMentionPopover, ChannelAutocomplete, CodeBlock)
   - `src/components/dm/*` (DMChatArea, DMHeader, DMSidebar, FriendsList, GroupChatHeader, GroupSettingsModal, CreateGroupModal, UserSearchResults)
   - `src/components/announcement/*`, `src/components/tasks/*`, `src/components/voice/*`, `src/components/settings/*`, `src/components/permissions/*`, `src/components/notifications/*`
   - `src/components/home/*`, `src/components/landing/*` (skip marketing-only brand colors)
   - `src/pages/AppLayout.tsx`, `src/pages/Auth.tsx`, `src/pages/DesktopAuth.tsx`, `src/pages/Join.tsx`, `src/pages/Index.tsx`

   Replace any remaining hardcoded greys/whites/blacks with the same semantic tokens used last pass (`bg-card`, `bg-popover`, `bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-primary`, etc.), preserving opacity modifiers. Skip the previously-documented preserved cases: status dots, role color swatches, avatar deterministic fallbacks, brand-color link previews (Discord/Facebook/etc.), bot tag brand colors.

**5. Smoke-check** — after changes, toggle Default → Dark → Light in Settings → Appearance and visually scan ChatArea, channel sidebar, member sidebar, DMs, settings pages, and modals to confirm chrome re-skins.

### Out of scope
- Removing the Gray theme (user explicitly wants all three kept).
- Changing the persisted theme id (`amoled`) — only the display name changes.
- Touching the preserved brand/status colors documented in the prior plan.
- Any non-color changes (layout, spacing, animation).
