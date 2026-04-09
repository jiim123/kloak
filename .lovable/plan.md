

## Stop the "Reconnecting" Banner on Tab Switch

### Problem
When you switch to another browser tab and come back, the app briefly shows a "Reconnecting..." banner. This happens because browsers throttle/pause WebSocket connections for background tabs. When you return, Supabase's realtime channel detects a stale state, triggering reconnection logic that flashes the banner — even though the connection recovers almost instantly (~1-2 seconds). The actual reconnection is fine and necessary; the problem is the **visible UI disruption**.

### Root Cause
In `useConnectionStatus.ts`, the realtime channel's `subscribe` callback fires `setConnectionStatus('reconnecting')` immediately on `CHANNEL_ERROR` or `CLOSED` events. The `ConnectionStatus.tsx` banner reacts instantly to this state change with no grace period.

Similarly, the visibility-change handlers in `useRealtimeMessages.ts` and `useRealtimeReactions.ts` log "re-establishing" messages and call `setupSubscription()` — which is correct for subscription health, but the status store update triggers the banner.

### Solution
Add a **debounce/grace period** before showing the reconnecting banner. The connection status store will still track state accurately, but the UI will only display the banner if the disconnection persists beyond a short threshold (3 seconds). Quick reconnections on tab-switch will resolve silently.

### Changes

**1. `src/components/ui/ConnectionStatus.tsx`** — Add a 3-second delay before showing the banner for reconnecting/disconnected states. If the connection recovers within that window, the banner never appears.

- Replace the current `useEffect` that sets `showBanner` with debounced logic:
  - When status becomes `reconnecting` or `disconnected`, start a 3-second timer
  - If status returns to `connected` before the timer fires, cancel it (no banner shown)
  - If the timer fires, show the banner
  - When status returns to `connected` while banner is visible, show "Connected" briefly then hide (existing behavior)

**2. `src/hooks/useRealtimeMessages.ts`** — Remove the `console.log` statements in the visibility-change handler to reduce noise. The reconnection logic itself stays.

**3. `src/hooks/useRealtimeReactions.ts`** — Same: remove the console.log in the visibility-change handler.

### What stays the same
- The actual reconnection logic (subscription health checks on tab return) is correct and remains unchanged
- The connection status store continues to track the real state accurately
- The 60-second heartbeat/latency polling is unchanged
- All realtime subscription recovery remains intact

This is purely a UI-level change: suppress brief, expected reconnections from being shown to the user.

