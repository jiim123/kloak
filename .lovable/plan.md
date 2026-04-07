

## Fix layout shift / element jump on AppLayout reload

### Problem
When the app reloads at `/app`, elements jump into position because:

1. **Loading → layout snap**: The full-screen `KloakDrawLoader` (centered spinner) transitions instantly to the multi-column layout (server sidebar + channel sidebar + content area) with no visual continuity.
2. **Framer Motion stagger animations in HomeLanding**: Elements animate from `opacity: 0, y: 20` → `opacity: 1, y: 0` with staggered delays, causing content to visibly pop into place. Despite `<MotionConfig reducedMotion="always">` wrapping the layout, Framer Motion's `reducedMotion="always"` only removes duration from animations — it doesn't prevent the initial/animate state diff from causing a single-frame jump.
3. **AlphaNoticeBanner conditional height**: Uses `AnimatePresence` with `height: 0 → auto` animation, which shifts everything below it when it expands on mount.
4. **ConnectionStatus conditional render**: Can insert a banner at the top that pushes content down after initial render.

### Changes

**File 1: `src/components/home/HomeLanding.tsx`**
- Remove Framer Motion stagger animations. Replace `motion.div` with plain `div` elements and set content to be immediately visible (no `initial="hidden"`, no `animate="show"`, no `variants`).
- This eliminates the staggered pop-in effect that causes the most visible layout shift.

**File 2: `src/components/layout/AlphaNoticeBanner.tsx`**
- Replace `AnimatePresence` + `motion.div` height animation with a simple conditional render using CSS `max-height` transition or direct show/hide. Since `app-no-motion` already kills CSS transitions inside `/app`, this will render instantly without layout shift.
- Alternatively, remove the animation entirely and use a simple `{isExpanded && <div>...</div>}` pattern.

**File 3: `src/pages/AppLayout.tsx`**
- Make the loading state layout match the final layout structure. Instead of a centered full-screen spinner, render the loading state *within* the same flex container structure (server sidebar placeholder + content area with centered spinner). This prevents the layout from jumping when auth completes.

### Technical details

**HomeLanding change** — Replace:
```tsx
<motion.div variants={container} initial="hidden" animate="show">
  <motion.div variants={item}>...</motion.div>
</motion.div>
```
With plain `<div>` elements (no animation).

**AlphaNoticeBanner change** — Replace AnimatePresence/motion.div with:
```tsx
{isExpanded && (
  <div className="overflow-hidden">
    <div className="px-6 pb-3 ...">...</div>
  </div>
)}
```

**AppLayout loading state change** — Replace the current loading block (lines 477-483):
```tsx
if (isLoading && !user) {
  return (
    <div className="h-screen bg-layout-chat flex items-center justify-center">
      <KloakDrawLoader />
    </div>
  );
}
```
With a skeleton that matches the final layout shape:
```tsx
if (isLoading && !user) {
  return (
    <div className="h-screen flex flex-col overflow-hidden app-layout-font">
      <div className="flex-1 flex overflow-hidden">
        {/* Placeholder matching sidebar width */}
        {!isMobileRaw && <div className="w-[72px] shrink-0 bg-layout-sidebar" />}
        {!isMobileRaw && <div className="w-[278px] shrink-0 bg-[#111111]" />}
        <div className="flex-1 bg-layout-chat flex items-center justify-center">
          <KloakDrawLoader />
        </div>
      </div>
    </div>
  );
}
```

