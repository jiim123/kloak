# Fix: `update_server` failing with "column updated_at does not exist"

## Root cause

The Bunny CDN upload for the icon/banner works fine. After upload, the client calls the `update_server` Postgres RPC to persist the new `icon_url` / `banner_url` on the `servers` row. That function does `SET ..., updated_at = now()`, but `public.servers` has no `updated_at` column (confirmed via schema query — columns are `id, name, icon_url, banner_url, owner_id, invite_code, created_at, is_published, about, system_channel_*, enable_*_messages, is_verified, is_nsfw, min_account_age_days, timezone`).

So nothing is wrong with the storage path — it's purely a missing DB column the RPC depends on.

## Change

One migration that adds the column and keeps it auto-maintained:

```sql
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows
UPDATE public.servers SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;

-- Auto-update on every row change (reuse existing helper if present, else create)
CREATE OR REPLACE FUNCTION public.set_servers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servers_updated_at ON public.servers;
CREATE TRIGGER trg_servers_updated_at
BEFORE UPDATE ON public.servers
FOR EACH ROW EXECUTE FUNCTION public.set_servers_updated_at();
```

No code changes needed — `update_server` will work as-is once the column exists. Icon/banner saving (and every other server settings save) will succeed again.

## Verification

After the migration:
1. Upload a new server icon → succeeds (Bunny upload + `update_server` RPC).
2. Upload a new server banner → succeeds.
3. Edit server name → succeeds.
