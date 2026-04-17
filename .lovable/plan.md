

## Plan: Replace Lucide Icons with Phosphor Icons

### Scope
- **129 files** import from `lucide-react`
- **~120 unique icons** in use
- A few files import the **type** `LucideIcon` / `LucideProps` for typed icon props (FeatureDetailModal, CreateChannelModal, ServerSettingsModal, fileIcons.ts, Index.tsx)
- `ChannelSidebar.tsx` already uses inline SVGs (no lucide) — leave it alone
- `SupportUsButton.tsx` uses inline crypto SVGs — leave those, only swap the lucide ones (`Heart`, `Coffee`, `ExternalLink`, `Copy`, `Check`, `X`)

### Approach

**1. Add dependency**
- Install `@phosphor-icons/react` (the official React package)
- Keep `lucide-react` in package.json initially, remove only after the migration is verified clean (do in same step — remove after final sweep)

**2. Build a name + prop mapping**
Phosphor differs from lucide in two ways:
- **Names** are different (e.g. `Hash` → `Hash`, `MessageSquare` → `ChatTeardrop`/`ChatCircle`, `Volume2` → `SpeakerHigh`, `MoreHorizontal` → `DotsThree`, `Trash2` → `Trash`, `Loader2` → `CircleNotch`, `Pencil` → `PencilSimple`, `Pin` → `PushPin`, `Check` → `Check`, `Hash` → `Hash`, etc.)
- **Props**: lucide uses `size`/`className`/`strokeWidth`; phosphor uses `size`/`weight`/`className`. We'll standardize on `weight="regular"` (or `"bold"` where lucide had `strokeWidth={2.5}+`) to keep visual parity with lucide's default ~2px stroke.

I'll produce a single mapping table covering all ~120 icons, with phosphor equivalents chosen for closest visual match. Where no exact equivalent exists (e.g. `Loader2` spinner), use `CircleNotch` with the existing `animate-spin` class.

**3. Codemod script (one-shot, then delete)**
Write a Node script (`/tmp/icon-codemod.mjs`) that:
- Walks `src/**/*.{ts,tsx}`
- For each file with `from "lucide-react"`:
  - Parses the imported names (handles `type LucideIcon`, `LucideProps`, aliases)
  - Rewrites the import to `from "@phosphor-icons/react"` using the mapped names
  - Renames JSX usages (`<Hash />` → `<Hash />`, `<MessageSquare />` → `<ChatCircle />`, etc.) — only for identifiers that came from the lucide import in that file
  - Replaces `strokeWidth={n}` props on those components with appropriate `weight="bold"`/`"regular"`
  - Replaces `LucideIcon` type → `Icon` (phosphor's exported component type) and `LucideProps` → `IconProps`
- Leaves all non-icon JSX untouched

Run, then manually spot-check 10–15 representative files (sidebars, headers, modals, message item, support button, voice controls, file icons).

**4. Type-prop file fixes**
- `src/lib/fileIcons.ts`: change `LucideProps` → `IconProps`, `IconComponent = React.FC<IconProps>`
- 4 modal files: `LucideIcon` → `Icon` (from phosphor)

**5. Cleanup**
- Run `tsc --noEmit` (via existing build pipeline) to catch any missed references
- Remove `lucide-react` from package.json
- Final grep to confirm zero `lucide-react` imports remain

**6. Visual parity notes**
- Phosphor's default `regular` weight ≈ lucide's default 2px stroke — close enough
- For headings/large icons that used `strokeWidth={2.5}` we use `weight="bold"`
- Icon sizes (`w-4 h-4` etc.) carry over unchanged since phosphor respects `className`

### Files explicitly NOT changed
- `src/components/layout/ChannelSidebar.tsx` (already inline SVG)
- The crypto SVGs inside `SupportUsButton.tsx` (only its lucide imports change)

### Risks / mitigations
- Bundle size: phosphor is tree-shakable (per-icon imports work the same way)
- Visual differences: phosphor icons have a slightly different geometric feel; if you want a closer-to-lucide look, we can use `weight="regular"` everywhere (default) — that's the plan
- A handful of icons have no 1:1 match (e.g. `LayoutGrid`, `Radar`, `Compass`, `SignalLow/Medium/High`) — I'll map to the closest phosphor equivalent (`SquaresFour`, `Radar`, `Compass`, `CellSignalLow/Medium/High`) and flag any in a final summary so you can review

### Deliverable
After running, every previously-lucide icon renders via `@phosphor-icons/react` with equivalent placement and size, no broken types, no leftover lucide imports.

