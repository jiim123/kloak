

## Fix layout shift / element jump on AppLayout reload

### Problem
Three sources cause visible layout jumps on reload and navigation:
1. **Loading state mismatch** — Full-screen centered loader snaps to multi-column layout
2. **HomeLanding stagger animations** — Framer Motion animates elements from invisible/offset to visible
3. **AlphaNoticeBanner height animation** — AnimatePresence animates height from 0→auto, pushing content down

### Changes

**File 1: `src/pages/AppLayout.tsx`** (lines 477-483)
- Replace the full-screen centered loader with a skeleton that matches the final layout structure
- Use `isMobileRaw` to conditionally show sidebar placeholders matching actual widths (72px server sidebar + 278px channel sidebar)
- Keep `KloakDrawLoader` centered in the content area

**File 2: `src/components/home/HomeLanding.tsx`**
- Remove all Framer Motion animation code: `container`/`item` variants, `motion.div` elements, `initial="hidden"`, `animate="show"`
- Replace with plain `div` elements so content renders instantly
- Remove unused `motion` import

**File 3: `src/components/layout/AlphaNoticeBanner.tsx`**
- Remove `AnimatePresence` and `motion.div` height animation
- Replace with simple conditional render: `{isExpanded && <div>...</div>}`
- Remove unused `motion`/`AnimatePresence` imports

### Summary
These three changes eliminate all animation-driven layout shifts: the loader matches the final layout shape, HomeLanding content appears instantly, and the alpha banner renders without height animation.

