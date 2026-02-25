

## Plan: Remove hCaptcha and Complete PoW Migration

### Summary

The `authStore.ts` `createAccount` currently calls the `register-with-captcha` edge function and requires an hCaptcha token. The `Auth.tsx` page renders an `<HCaptcha>` widget and passes the token through. The PoW helper functions (`fetchPoWChallenge`, `solvePoWChallenge`) exist in `crypto.ts` but the two edge functions (`generate-challenge`, `register-with-pow`) do **not** exist yet — they need to be created. The `pow_challenges` table exists in the database already.

### Changes Required

#### 1. Create Edge Function: `generate-challenge`
New file: `supabase/functions/generate-challenge/index.ts`

- Accepts GET or POST requests (no auth required)
- Uses service_role Supabase client to insert a row into `pow_challenges` with a random nonce and difficulty (default 4)
- Returns `{ id, nonce, difficulty, expires_at }` as JSON
- Includes CORS headers for the same allowed origins pattern
- Config in `supabase/config.toml`: `verify_jwt = false`

#### 2. Create Edge Function: `register-with-pow`
New file: `supabase/functions/register-with-pow/index.ts`

- Accepts POST with body: `{ username, key_hash, challenge_id, solution, banner_color? }`
- Validates the PoW solution:
  - Fetches the challenge row from `pow_challenges` by `id`
  - Checks it's not expired and not already used
  - Computes `SHA-256(nonce + solution)` and verifies it starts with `difficulty` zeros
  - Marks the challenge as `used = true`
- Calls `register_user` RPC (same logic currently in `register-with-captcha`) with service_role
- Returns user data on success
- Same origin-checking and CORS patterns as the captcha function
- Config in `supabase/config.toml`: `verify_jwt = false`

#### 3. Update `authStore.ts` — `createAccount`
- Remove `hcaptchaToken` parameter (signature becomes `createAccount(username: string)`)
- Remove the `if (!hcaptchaToken)` guard that blocks registration
- Replace the `register-with-captcha` fetch with:
  1. Call `fetchPoWChallenge()` to get challenge `{ id, nonce, difficulty }`
  2. Call `solvePoWChallenge(nonce, difficulty)` to compute the solution
  3. POST to `register-with-pow` with `{ username, key_hash, challenge_id, solution, banner_color }`
- Update the type signature in the `AuthState` interface accordingly

#### 4. Update `Auth.tsx`
- Remove `import HCaptcha from "@hcaptcha/react-hcaptcha"` (line 41)
- Remove `hcaptchaSiteKey` variable (line 94) and `hcaptchaRef` (line 95)
- In `handleCreateAccount`: remove the entire captcha token block (lines 235–260), remove `captchaToken` from `createAccount()` call, remove `hcaptchaRef.current?.resetCaptcha()` calls
- Remove both `<HCaptcha>` component renders (lines 529–538 and 753–762) from the Tauri and web registration forms
- The comment on line 93 (`// hCaptcha (registration only)...`) is also removed

#### 5. Update `supabase/config.toml`
- Add entries for the two new edge functions:
  ```
  [functions.generate-challenge]
  verify_jwt = false

  [functions.register-with-pow]
  verify_jwt = false
  ```

#### 6. Final sweep
- Search entire codebase for any remaining `hcaptcha`, `captcha`, `HCaptcha`, `CAPTCHA` references in `.ts`/`.tsx` files and remove them
- The `register-with-captcha` edge function and its config entry will be left untouched (as instructed: "All existing Edge Functions must remain untouched")
- The `@hcaptcha/react-hcaptcha` package will no longer be imported but can remain in `package.json` (unused dependency — harmless)
- `VITE_HCAPTCHA_SITE_KEY` stays in `.env` but nothing references it

### What does NOT change
- All existing edge functions (including `register-with-captcha`) remain deployed and untouched
- All RLS policies and database tables remain unchanged
- The `pow_challenges` table already exists with the right schema
- Login flow, secret key display, username validation, onboarding modal — all unchanged
- `fetchPoWChallenge()` and `solvePoWChallenge()` in `crypto.ts` — unchanged

