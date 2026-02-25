

## Plan: Update Supabase Anon Key

The `.env` file contains a stale anon key that was rotated on the Supabase dashboard. This is why all client-side RPC calls (like `login_user`) return 401 "Invalid API key".

### Single Change Required

Update `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` from the old key to the new one:

**Old (stale):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTUyMDYsImV4cCI6MjA4MTY3MTIwNn0.MX1wK26ZEx7zA9x-hY7hAaRXTh4RKX2upG4AGNBNIRk
```

**New (valid):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODUwNjEsImV4cCI6MjA4NzA0NTA2MX0.XgkhNWxe7CHzeyc8PrXJKztuT6oxFYXX1T8Fab1N6QA
```

This is the only change needed. No code changes required — the Supabase client in `client.ts` already reads from this env var. Once updated, all RPC calls (`login_user`, etc.) will authenticate correctly.

