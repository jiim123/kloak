

## INSERT Protection Audit Checklist

Legend: **Y** = exists, **--** = missing, **N/A** = not applicable for this table

```text
Table                    | Identity | Rate Limit | Mute Check | Age Gate | Content Filter | FORCE RLS
-------------------------|----------|------------|------------|----------|----------------|----------
channel_members          |    Y     |     Y      |     --     |    --    |      N/A       |    Y
dm_attachments           |    Y     |     Y      |     --     |    --    |      N/A       |    Y
dm_conversations         |   N/A¹   |    N/A¹    |    N/A¹    |   N/A¹  |     N/A¹       |    Y
dm_participants          |   N/A¹   |    N/A¹    |    N/A¹    |   N/A¹  |     N/A¹       |    Y
message_attachments      |    Y     |     Y      |     --     |    --    |      N/A       |    Y
thread_attachments       |    Y     |     Y      |     --     |    --    |      N/A       |    Y
threads                  |    Y     |     Y      |     --     |    --    |      N/A       |    Y
servers                  |    Y     |     --     |     --     |    --    |      N/A       |    Y
declined_friend_requests |    Y     |     --     |     --     |    --    |      N/A       |    Y
```

¹ `dm_conversations` and `dm_participants` INSERT policies are `WITH CHECK (false)` — inserts are blocked at the RLS level and only happen via SECURITY DEFINER RPCs. No additional protections needed.

### Also verified (from prior work, confirmed above):

```text
Table                    | Identity | Rate Limit | Mute Check | Age Gate | Content Filter | FORCE RLS
-------------------------|----------|------------|------------|----------|----------------|----------
reactions                |    Y     |     Y      |     Y      |    Y     |      N/A       |    --²
dm_reactions             |    Y     |     Y      |     Y      |    Y     |      N/A       |    --²
thread_reactions         |    Y     |     Y      |     Y      |    Y     |      N/A       |    --²
server_members           |    Y     |     Y      |     Y      |    Y     |      N/A       |    --²
thread_messages          |    Y     |     Y      |     Y      |    Y     |      Y         |    --²
```

² These were not in the scoped audit but appear well-protected from the policy listing.

---

### Gaps to Fix

1. **Mute check missing on**: `channel_members`, `dm_attachments`, `message_attachments`, `thread_attachments`, `threads`, `servers`, `declined_friend_requests`
2. **Account age gate missing on**: `channel_members`, `dm_attachments`, `message_attachments`, `thread_attachments`, `threads`, `servers`, `declined_friend_requests`
3. **Rate limit missing on**: `servers`, `declined_friend_requests`

### Proposed Fixes (pending your approval)

For each table missing protections, add RESTRICTIVE INSERT policies:

- **Mute check**: `NOT is_user_muted(<user_column>)` — 7 tables
- **Account age (2 min)**: Require account created >= 2 minutes ago — 7 tables
- **Rate limit for `servers`**: e.g., 3 per hour (create a `check_server_create_rate_limit` function)
- **Rate limit for `declined_friend_requests`**: e.g., 20 per hour (create a `check_decline_rate_limit` function)

No existing policies, functions, or constraints will be modified or dropped. No UI changes.

### Also: Fix the build error

The TypeScript build error in `generate-challenge/index.ts` and `register-with-pow/index.ts` is caused by the `AnySupabaseClient` type in `registrationSecurity.ts` not matching the actual Supabase client type. Fix: widen the type to `any` or use a compatible generic signature.

