## Issue 1 — MembersSidebar skeleton leaks below MessageInput on mobile

**Root cause:** In `src/components/layout/MembersSidebar.tsx`, the loading branch returns early *before* the `isMobile` Drawer wrapper is applied:

```tsx
if (isMembersLoading && members.length === 0) {
  return <MembersSidebarSkeleton />;   // ← rendered inline, no Drawer
}
// ...
if (isMobile) {
  return <Drawer ...><DrawerContent>{sidebarContent}</DrawerContent></Drawer>;
}
return sidebarContent;
```

On mobile the component is mounted in the layout tree but is meant to be hidden behind a closed Drawer. Because the skeleton bypasses the Drawer, it renders as a normal block in the page flow — landing below `MessageInput` (which is where `<MembersSidebar />` appears in the desktop chat layout). When the Drawer is later opened, the data has loaded and the proper Drawer-wrapped UI shows correctly.

**Fix:** Move the loading branch *after* the `isMobile` check, so the skeleton is wrapped in the same Drawer on mobile (and renders nothing visible while the Drawer is closed). On desktop, behavior stays identical.

```tsx
const body = (isMembersLoading && members.length === 0)
  ? <MembersSidebarSkeleton />
  : sidebarContent;

if (isMobile) {
  return (
    <Drawer direction="right" open={isMemberSidebarOpen} onOpenChange={setMemberSidebarOpen} modal={false}>
      {isMemberSidebarOpen && <div className="fixed inset-0 z-50 bg-black/80" onClick={handleCloseSidebar} />}
      <DrawerContent ...>
        <DrawerHeader className="sr-only"><DrawerTitle>Members</DrawerTitle></DrawerHeader>
        <div className="h-full overflow-hidden">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
return body;
```

## Issue 2 — Send button stuck on "sending" (Loader2) icon after send

**Root cause:** The send button uses `AnimatePresence mode="wait"` to swap between `<Loader2>` (key `loader`) and `<Send>` (key `send`) based on `isSending` (`MessageInput.tsx` lines 344–368). The `isSending` state itself toggles correctly (the `finally` block at line 961 always resets it), but `mode="wait"` is known to get stuck when the underlying state flips faster than the 200 ms exit animation — exactly what happens on a short channel message where the optimistic send resolves in <100 ms. The exit promise of the just-mounted `Loader2` never settles, so the `Send` child never gets to enter, and the loader visibly stays on screen.

**Fix:** Replace the `AnimatePresence mode="wait"` swap with a single icon that conditionally renders, with a lightweight fade/scale via `motion.span` keyed on `isSending` but *without* `mode="wait"`. Either:

- Drop `AnimatePresence` entirely and just render `{isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}`, or
- Keep `AnimatePresence` but remove `mode="wait"` so both children can overlap during the brief transition.

The simpler conditional render is preferred — it removes a class of race conditions and the icon swap visually reads fine without the cross-fade.

## Files touched

- `src/components/layout/MembersSidebar.tsx` — restructure loading early-return so it lives inside the mobile Drawer.
- `src/components/chat/MessageInput.tsx` — replace the `AnimatePresence mode="wait"` send/loader swap with a direct conditional render (or remove `mode="wait"`).

No DB, RPC, store, or behavior changes — purely presentation/render-flow fixes.
