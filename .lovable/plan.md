

## Increase Server Emoji Limit to 1000

### Current State
- The emoji limit is **30 per server**, enforced **only on the client side** in three files
- The server-side `upload_server_emoji` RPC function has **no limit check at all** -- anyone bypassing the UI could upload unlimited emojis
- This is a security gap that needs fixing

### Changes

#### 1. Add server-side limit enforcement (database migration)
Update the `upload_server_emoji` RPC function to count existing emojis for the server and reject uploads if the count is >= 1000. This prevents abuse regardless of how the request is made.

```sql
-- Inside upload_server_emoji, before the INSERT:
IF (SELECT count(*) FROM server_emojis WHERE server_id = _server_id) >= 1000 THEN
  RAISE EXCEPTION 'Server emoji limit reached (max 1000)';
END IF;
```

#### 2. Update client-side limits
Change `MAX_SERVER_EMOJIS` from `30` to `1000` in three files:
- `src/components/settings/ServerSettingsPage.tsx` (line 106)
- `src/components/modals/ServerSettingsModal.tsx` (line 98)
- `src/components/modals/ImportEmojiPackModal.tsx` (line 15)

#### 3. Files affected
| File | Change |
|------|--------|
| Database migration (new) | Recreate `upload_server_emoji` with 1000-emoji limit check |
| `src/components/settings/ServerSettingsPage.tsx` | `MAX_SERVER_EMOJIS = 1000` |
| `src/components/modals/ServerSettingsModal.tsx` | `MAX_SERVER_EMOJIS = 1000` |
| `src/components/modals/ImportEmojiPackModal.tsx` | `MAX_SERVER_EMOJIS = 1000` |

