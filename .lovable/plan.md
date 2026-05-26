Delete the unused `supabase/functions/storage-upload/` edge function from both the codebase and the deployed Supabase project.

1. Remove `supabase/functions/storage-upload/index.ts` from the repo.
2. Call `supabase--delete_edge_functions` with `["storage-upload"]` to clean up the deployed function.

This function is dead code — no frontend code references it. All uploads in the app now route through the Bunny CDN upload pipeline (`bunny-upload.ts` → `upload-to-bunny` edge function). Removing it prevents accidental invocation or confusion for future developers.