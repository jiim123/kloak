
## Backend Security Hardening — Applied Fixes

All fixes from the audit have been applied. Summary:

### CRITICAL
1. ✅ **Debug functions restricted** — Revoked EXECUTE from anon/authenticated/public on `debug_channel_permissions`, `debug_server_system_messages`, `debug_user_permission`, `debug_request_headers`

### HIGH
2. ✅ **thread_messages content filtering** — Added `message_content_allowed()` RESTRICTIVE INSERT policy
3. ✅ **thread_messages account age gate** — 5-minute minimum account age for thread posting
4. ✅ **direct_messages content filtering** — Added `message_content_allowed()` RESTRICTIVE INSERT policy

### MEDIUM
5. ✅ **insert_announcement_comment hardened** — Added 2000 char cap, content filtering, rate limit (10/min), duplicate detection (30s), 5-min account age gate
6. ✅ **insert_media_comment hardened** — Same protections as announcement comments
7. ✅ **insert_media_item hardened** — Added rate limit (10/min), 5-min account age gate, URL length validation (2048), title/description length caps
8. ✅ **send_message mention spam protection** — Max 5 `<@uuid>` mentions per message
9. ✅ **Edge functions already protected** — fetch-discord-template, fetch-emoji-pack, fetch-link-preview-asset all have auth + rate limiting

### LOW
10. ✅ **Message length harmonized** — send_message RPC now uses 4000 chars (matching RLS policy)
11. ✅ **Reaction account age gates** — 2-minute minimum for both channel reactions and DM reactions
