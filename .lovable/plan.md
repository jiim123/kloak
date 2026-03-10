

# Backend Security Audit & Hardening Plan

## Phase 1: RLS Policy Audit Results

### 1A: RLS Status
All 51 public tables have RLS enabled. No tables are exposed without access control.

### 1B: INSERT Policy Audit

**Findings:**

| # | Vulnerability | Severity | Table(s) |
|---|---|---|---|
| 1 | **No content filtering on thread_messages INSERT** -- `messages` has `message_content_allowed()` and `messages_account_age_min_5m` policies, but `thread_messages` INSERT has neither content filtering nor account age gating | HIGH | `thread_messages` |
| 2 | **No content filtering on direct_messages INSERT** -- DM INSERT policy checks length/emptiness but not `message_content_allowed()` | HIGH | `direct_messages` |
| 3 | **No content filtering on announcement_comments, media_comments** -- RPCs `insert_announcement_comment` and `insert_media_comment` lack content validation and rate limiting | MEDIUM | via RPCs |
| 4 | **No account age gate on reactions INSERT** -- users can add reactions immediately after registration | LOW | `reactions` |
| 5 | **No account age gate on DM reactions** | LOW | `dm_reactions` |
| 6 | **No mention spam limit** -- `messages` INSERT doesn't cap the number of @-mentions per message | MEDIUM | `messages` |

### 1C: SELECT Policy Audit
All SELECT policies properly require `requesting_user_id()` and membership checks. Realtime bypass is scoped to the `realtime` role. No issues found.

### 1D: UPDATE/DELETE Policy Audit
All UPDATE/DELETE policies verify ownership via `requesting_user_id()`. Moderator actions correctly check permissions. No issues found.

---

## Phase 2: Edge Function Audit Results

| Function | Auth | Rate Limit | Input Validation | Issues |
|---|---|---|---|---|
| `agora-token` | x-key-hash | Yes (10/min) | UUID regex | OK |
| `broadcast-typing` | x-key-hash | Yes (120/min) | UUID regex | OK |
| `cleanup-attachments` | Service role | N/A | N/A | OK |
| `fetch-discord-template` | None required | Needs check | Needs check | **MEDIUM: Needs audit** |
| `fetch-emoji-pack` | None required | Needs check | Needs check | **MEDIUM: Needs audit** |
| `fetch-link-preview` | x-key-hash | Yes | URL validation, SSRF protection | OK |
| `fetch-link-preview-asset` | Needs check | Needs check | Needs check | **MEDIUM: Needs audit** |
| `generate-challenge` | None (public) | Yes (10/min) | N/A | OK |
| `get-livekit-token` | x-key-hash | Yes (10/min) | UUID regex | OK |
| `giphy-search` | x-key-hash | Yes (90/min) | Needs check | OK |
| `klipy-proxy` | x-key-hash | Yes (90/min) | Validated | OK |
| `maintenance-mode` | None (public) | Yes (60/min) | N/A | OK |
| `register-with-captcha` | CORS-restricted | Yes (multi-tier) | hCaptcha + origin | OK |
| `register-with-pow` | None (public) | Yes (multi-tier) | PoW + username validation | OK |
| `send-join-application` | None (public) | Yes (5/10min) | Length limits, email validation | OK |
| `storage-upload` | x-key-hash | Yes (60/min) | Path validation, bucket checks | OK |
| `update-user-profile` | x-key-hash | Yes (30/min) | RPC validates fields | OK |

**CORS**: All functions use wildcard `Access-Control-Allow-Origin: *`. This is acceptable since the custom auth system uses `x-key-hash` headers (not cookies), making CSRF impossible. `register-with-captcha` additionally validates origins.

**Debug functions exposed**: `debug_channel_permissions`, `debug_server_system_messages`, `debug_user_permission` are callable by `anon` and leak internal permission/server configuration details. **HIGH** severity -- should be restricted to admins or removed in production.

---

## Phase 3: Realtime Publication Audit

18 tables in the `supabase_realtime` publication. All have RLS enabled. Tables like `channel_reads`, `channel_permissions`, `role_permissions`, `server_member_roles`, `server_roles` have `default` replica identity -- this could cause issues with UPDATE/DELETE propagation, but is not a security vulnerability. No sensitive columns are being broadcast that shouldn't be.

---

## Phase 4: RPC Function Audit

### Critical Findings:

| # | Function | Issue | Severity |
|---|---|---|---|
| 1 | `debug_channel_permissions` | Exposes full permission tree for any channel/user -- no auth check, callable by anon | **HIGH** |
| 2 | `debug_server_system_messages` | Exposes server config including invite codes -- no auth check | **HIGH** |
| 3 | `debug_user_permission` | Exposes detailed permission resolution -- no auth check | **HIGH** |
| 4 | `insert_announcement_comment` | No rate limiting, no content length validation, no content filtering | **MEDIUM** |
| 5 | `insert_media_comment` | No rate limiting, no content length validation, no content filtering | **MEDIUM** |
| 6 | `insert_media_item` | No rate limiting, no URL validation on media_url | **MEDIUM** |
| 7 | `send_message` | Content limit is 2000 chars in RPC but 4000 in RLS policy -- inconsistent | **LOW** |

### Anon-Accessible Functions (Intentionally Public):
`login_user`, `register_user`, `check_username_available`, `ping_health`, `check_e2e_status` -- all have rate limiting, OK.

### Anon-Accessible Functions (Should Review):
All SECURITY DEFINER mutation RPCs are callable by `anon`, which is correct for this custom auth system (they internally verify identity via `verify_request_identity`).

---

## Phase 5: Foreign Key Cascade Audit

All user-referencing foreign keys use `CASCADE` on delete except:
- `channel_members.added_by` → `SET NULL` (correct)
- `dm_conversations.created_by` → `SET NULL` (correct -- conversation survives creator deletion)
- `server_invites.revoked_by` → `SET NULL` (correct)

No blocking `NO ACTION` or `RESTRICT` rules found. Foreign key configuration is clean.

---

## Phase 6: Fix Plan

### CRITICAL Fixes

1. **Revoke anon access to debug functions** -- Remove EXECUTE grants from `anon`/`authenticated` for `debug_channel_permissions`, `debug_server_system_messages`, `debug_user_permission`, or add identity + admin checks inside them.

### HIGH Fixes

2. **Add content filtering to thread_messages** -- Add `message_content_allowed()` as a RESTRICTIVE INSERT policy on `thread_messages`, matching the `messages` table pattern.

3. **Add content filtering to direct_messages** -- Add `message_content_allowed()` as a RESTRICTIVE INSERT policy on `direct_messages`.

4. **Add account age gate to thread_messages INSERT** -- Require 5-minute account age (matching `messages`).

### MEDIUM Fixes

5. **Add rate limiting + content validation to `insert_announcement_comment`** -- Add content length cap (2000 chars), rate limit (10/min), duplicate detection, and `message_content_allowed()` check.

6. **Add rate limiting + content validation to `insert_media_comment`** -- Same protections as above.

7. **Add rate limiting to `insert_media_item`** -- Cap at 10/min per user, validate media_url format.

8. **Add mention spam protection to `send_message`** -- Count `@` mentions in content, cap at 5 per message.

9. **Audit and protect `fetch-discord-template`, `fetch-emoji-pack`, `fetch-link-preview-asset`** -- Add auth and rate limiting if missing.

### LOW Fixes

10. **Harmonize message length limit** -- Align `send_message` RPC's 2000-char limit with the RLS policy's 4000-char limit (use 4000 in both, or 2000 in both).

11. **Add account age gate on reactions** -- Require 2-minute account age for adding reactions.

### Items NOT needed (already covered):

- Global mute system: `server_members.is_muted` already blocks messages via `send_message` RPC
- Duplicate content detection: Already present in `send_message` (15s) and `send_dm` (30s)
- DM account age gating: Already enforced (2 min in `send_dm`, 10 min in `create_group_dm`)
- Message length limits on DMs: Already enforced (2000 chars in RPC + 4000 in RLS)
- Registration spike alerting: Deferred (requires additional infrastructure)

### Implementation approach:

All fixes will be database migrations (RLS policies, function updates) and edge function edits. No UI changes. Each fix targets a specific vulnerability documented above.

