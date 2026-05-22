## Goal

All settings surfaces (User, Server, Channel) currently roll their own layout, spacing, card styles, headers, and typography — leading to inconsistency, performance bloat (each file is 1k–4.3k lines of bespoke JSX), and weak responsive behavior. We'll introduce a small shared **Settings UI kit** and migrate the three pages onto it. Reference: Linear-style sidebar + content with crisp hierarchy (bright/bold section titles, muted body, grouped cards).

## What's wrong today

- `ServerSettingsPage.tsx` (4308 lines), `UserSettingsModal.tsx` (1670), `ChannelSettingsPage.tsx` (1000) each define their own section wrappers, row layouts, headers, and even custom `Button` overrides.
- No shared "settings card", "settings row", or "settings section header" primitive — copy/pasted inline class strings drift.
- Headlines/titles use the same weight & color as body copy in most sections (low hierarchy).
- Mobile: tab strips overflow; some sections (Emojis, Roles, Members) only work on desktop widths. Desktop: content width unconstrained on ultra-wide; inconsistent gutters.
- Heavy single-file modules hurt perf (re-render cost, bundle, code-split). All three load even when only one tab is open.

## Shared UI kit (new)

New folder `src/components/settings/ui/`:

- `SettingsLayout.tsx` — responsive shell: left rail (sidebar nav) + right scroll area. Desktop ≥ md: persistent 240px rail, content `max-w-3xl` centered with 32px gutter. Mobile: rail collapses to a top section picker (Sheet/Drawer trigger from header), content full-width with 16px gutter.
- `SettingsSidebar.tsx` — grouped nav (label + items), active highlight, supports icons. Used by all three pages.
- `SettingsHeader.tsx` — page title row (back button on mobile, title, optional actions). Title uses `text-foreground font-semibold text-lg md:text-xl`.
- `SettingsSection.tsx` — section container with a bright/bold heading + muted description. Heading: `text-foreground font-semibold text-base`, description: `text-muted-foreground text-sm`.
- `SettingsCard.tsx` — `bg-card border border-border/50 rounded-[6px]` group container with consistent padding (p-4 md:p-5) and `divide-y divide-border/40` for stacked rows.
- `SettingsRow.tsx` — label + description on the left, control on the right. Auto stacks to column on mobile. Label: `text-foreground font-medium text-sm`; description: `text-muted-foreground text-xs`.
- `SettingsField.tsx` — labeled input/textarea wrapper with consistent spacing and helper/error text.
- `DangerZone.tsx` — destructive section preset (red-tinted border, same SettingsCard underneath).

All tokens semantic (no hardcoded hex). Typography hierarchy rule across the kit:
- Page title: `text-foreground font-semibold`
- Section title: `text-foreground font-semibold` (brighter + bolder than body)
- Row label: `text-foreground font-medium`
- Body / description: `text-muted-foreground` (lighter, regular)

## Page-level changes

### 1. UserSettingsModal
- Keep Dialog wrapper. Replace inner layout with `SettingsLayout`.
- Split each tab into its own file under `src/components/settings/user/` (Profile, Account, Privacy, Notifications, Voice, Appearance, Keybinds, Language, Advanced). Lazy-load via `React.lazy` so opening Profile doesn't parse Voice settings.
- Convert every "toggle row" to `SettingsRow`; every grouped block to `SettingsCard` + `SettingsSection`.

### 2. ServerSettingsPage
- Move to `SettingsLayout`. Split Overview, Roles, Members, Channels/Categories, Emojis, Bots, Invites, Audit, Danger Zone into files under `src/components/settings/server/` and lazy-load.
- Replace local `Button` override + ad-hoc cards with `SettingsCard`/`SettingsRow`.
- Roles/Members keep their richer UIs but wrapped in `SettingsCard` so spacing and headings match the rest.
- Danger Zone (delete server, transfer ownership) moves to `DangerZone`.

### 3. ChannelSettingsPage
- Same migration: `SettingsLayout` + sectioned tabs (Overview, Permissions, Members, Invites, Integrations, Delete).
- Permission overrides table reused as-is but inside `SettingsCard`.

### 4. ServerBotsPanel
- Light pass: rewrap in `SettingsSection` + `SettingsCard` so it visually matches when embedded in ServerSettings.

## Responsiveness rules (applied uniformly)

- Breakpoint: `md` (768px) matches existing `useIsMobile`.
- Mobile: header sticky top with back chevron + current section name + sheet trigger to switch section. Content padding `px-4 py-4`. Rows stack. Touch targets ≥ 44px (carrying over the recent MessageInput/EmojiPicker fix pattern: `h-11 sm:h-9`).
- Desktop: left rail `w-60` sticky, content `max-w-3xl mx-auto px-8 py-8`. Rows are 2-column (label/control). No horizontally-scrolling tab strips.
- Scroll containment inside `SettingsLayout`'s right column only — no nested scroll traps.

## Perf wins

- Code-split each tab via `React.lazy` + `Suspense` (smaller initial parse, faster open).
- Remove duplicated inline class strings (smaller JSX, less reconciliation).
- Memoize heavy sub-lists (Members, Emojis) with `useMemo` keyed on stable ids — already partially present, will be consistent.
- Drop dead imports surfaced during extraction.

## Out of scope

- No business-logic / RPC / data changes.
- No new permissions or features.
- No theme / token additions beyond what's already in `index.css`.

## File map

```text
src/components/settings/
  ui/
    SettingsLayout.tsx
    SettingsSidebar.tsx
    SettingsHeader.tsx
    SettingsSection.tsx
    SettingsCard.tsx
    SettingsRow.tsx
    SettingsField.tsx
    DangerZone.tsx
    index.ts
  user/        (extracted tabs from UserSettingsModal)
  server/      (extracted tabs from ServerSettingsPage)
  channel/     (extracted tabs from ChannelSettingsPage)
  ServerSettingsPage.tsx   (slim shell)
  ChannelSettingsPage.tsx  (slim shell)
src/components/modals/UserSettingsModal.tsx  (slim Dialog shell)
```

## Validation

- Visual pass at 375px, 768px, 1024px, 1440px on each page.
- Confirm all controls keep current behavior (toggles, forms, uploads) — no logic changes.
- Confirm headlines are visibly brighter/bolder than body via design tokens.
