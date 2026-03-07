

# Audit Findings: Four Features

## 1. Roles & Permissions System

**What exists:**
- Frontend: `evaluatePermission()` in `src/lib/permissions.ts` follows a 6-step evaluation: Owner → user channel overrides → role channel overrides → server-wide role permissions → @everyone role → base role defaults.
- `useMemberPermissions` hook wraps this for components.
- Backend: `check_user_permission` (channel-scoped) and `check_user_server_permission` (server-scoped) RPC functions. RLS policies on `messages`, `reactions`, `channel_members`, etc. call these functions.
- Base role defaults exist in the frontend for admin (all true), moderator (explicit allow list), and member (explicit allow list). `manage_threads` IS included in the frontend moderator list (line 156).

**What is broken:**
- The `check_user_server_permission` DB function (used by server-level actions like `manage_invites` on `server_invites` RLS) historically lacked base role fallback defaults. The backup file `backup/20260202000002_align_server_permission_function.sql` contains the fix, but it's in a `backup/` directory — it's unclear if this migration was actually applied to the live database.
- If the migration was NOT applied, moderators and admins without explicit `role_permissions` rows will be denied server-level permissions (kick, ban, manage_channels, etc.) because the function falls through to `RETURN false`.

**Recommended fix:**
- Verify whether `check_user_server_permission` in the live DB includes the CASE fallback defaults. If not, apply the migration from `backup/20260202000002`. This is the most likely cause of "moderators not receiving correct permissions."
- The frontend logic appears correct and aligned with the DB defaults.

---

## 2. Link Preview Embeds

**What exists:**
- `src/components/chat/LinkPreview.tsx` (789 lines) — comprehensive component supporting: YouTube, Spotify, SoundCloud, Twitch, Kick, Vimeo, Steam, TikTok, Instagram, Facebook, Twitter/X, Reddit, LinkedIn, and generic OG metadata previews.
- Edge function `fetch-link-preview` fetches metadata server-side. A separate `fetch-link-preview-asset` edge function proxies images.
- IntersectionObserver defers fetching until near-viewport (200px margin).
- Preview cache with 30-min TTL for success, 2-min for errors.
- `embedStore` manages active live embeds (Twitch/Kick streams) and per-message hide state.
- User preference toggle (`linkPreviewsEnabled`) in settings.

**What is broken/incomplete:**
- The edge function is `fetch-link-preview` but the `supabase/config.toml` only lists `fetch-link-preview-asset` — the main `fetch-link-preview` function is not listed in config, meaning it may not be deployed or may lack configuration.
- No obvious broken logic in the frontend component itself. Issues would likely be edge function deployment or specific provider parsing failures.

**Recommended fix:**
- Verify that the `fetch-link-preview` edge function exists and is deployed. Add it to `supabase/config.toml` if missing.
- If specific providers are failing, inspect edge function logs for those URLs.

---

## 3. Search & Add Friends (DMSidebar)

**What exists:**
- `DMSidebar.tsx` has a search input (line 136-143) with placeholder "Find or start a conversation."
- The search only filters **existing conversations** in memory (line 51-64) — it filters `conversations` by username/display_name match.
- It does NOT search for new users or provide friend-add functionality.
- Friend adding is handled entirely in `FriendsList.tsx` (separate component, shown in the main content area), which has an "Add Friend" button that reveals an input for entering an exact username, calling `send_friend_request` RPC.

**What is broken:**
- The DMSidebar search is **not broken** — it was never designed to search/add friends. It only filters existing DM conversations.
- The friend-add flow lives exclusively in `FriendsList` (accessible via the "Friends" button in the sidebar, rendered in the main panel). If users expect to search and add friends directly from the sidebar search bar, that feature simply doesn't exist.
- The `sendRequest` function in `friendStore.ts` works correctly — it calls the `send_friend_request` RPC and refreshes the friends list.

**Recommended fix:**
- If the goal is to allow searching for new users and sending friend requests from the DMSidebar search bar: add a user search RPC that returns matching users (not just existing conversations), and display search results with an "Add Friend" action below the conversation list.
- Alternatively, make the "Find or start a conversation" search bar also trigger a user lookup when no existing conversations match, showing an option to send a friend request.

---

## 4. Message Highlighting & Scroll-to-Message

**What exists:**
- `useScrollToMessage` hook handles both URL-based (`?message=id`) and event-based (custom `scrollToMessage` DOM event) navigation.
- Reply clicks in `MessageItem.tsx` (line 885) dispatch a `CustomEvent("scrollToMessage")`.
- The hook: resets state → checks if message exists in loaded history → if not, fetches older messages (up to 5 batches of 50) → once found, scrolls to index (150ms delay) → highlights after 400ms → clears highlight after 2900ms.
- Works with both virtualized lists (`scrollToIndex`) and plain scroll containers (DOM-based scroll).

**What is broken:**
- The scroll effect (line 99-143) uses `messages` and `targetMessageId` as dependencies. When the event fires, it sets `eventTargetId` (state update) which triggers a re-render. But the scroll effect checks `hasScrolledRef.current` — if the effect fires before the DOM has rendered the target element, `scrollToIndex` may target the correct index but the element may not be painted yet, causing a visual miss.
- The 150ms `setTimeout` delay is a best-effort workaround, but on slower devices or when messages are being fetched, this may not be enough time for the virtual list to render the target item.
- When the message needs to be fetched (not in loaded history), the fetch effect and scroll effect race: the fetch sets `isFetchingRef` and the scroll effect checks `messages.findIndex` — but after fetch completes, the scroll effect re-runs. This part actually works correctly on re-render after fetch.
- The most likely cause of "requires multiple taps": if `fetchMessages` is needed but `currentChannelId` is null/stale (e.g., notification navigates to a channel that isn't yet set as current), the fetch effect bails at line 80. The first tap navigates to the channel, the second tap works because `currentChannelId` is now set.

**Recommended fix:**
- Increase the scroll delay or use a `requestAnimationFrame` + retry pattern to ensure the DOM element exists before scrolling.
- For notification-based navigation (URL with `?message=id`), ensure the channel is fully loaded and `currentChannelId` is set before the scroll hook attempts to fetch. This may require waiting for the channel's initial message load to complete before activating the scroll logic.
- Consider adding a small retry loop (2-3 attempts with 200ms intervals) for the `scrollToIndex` call when the target element is not yet in the DOM.

