

# Fix: Media channel uploads sending wrong URL format

## Problem

When uploading to a media channel, line 406 in `MediaChannelArea.tsx` constructs a `kloak-attachment://` URL:
```
mediaUrl = `kloak-attachment://${result.path}`;
```

The `insert_media_item` RPC requires a valid `http(s)://` URL (enforced by a database constraint), so this fails with `"Media URL must be a valid http(s) URL"`.

## Fix

One line change in `src/components/media/MediaChannelArea.tsx` line 406:

Replace `kloak-attachment://${result.path}` with `result.publicUrl`, which is the full Bunny CDN URL (e.g. `https://kloakcdn.b-cdn.net/attachments/...`).

`secureUpload` already returns the CDN URL as `publicUrl` for attachment uploads, so no other files need changes.

## Files Modified

1. `src/components/media/MediaChannelArea.tsx` — line 406 only

