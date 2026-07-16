# Kloak Mobile WebView

Thin Expo shell that loads the Kloak web app in a native WebView and owns phone push notification registration.

## Run With Expo

```powershell
cd mobileapps-new
npm install
npx expo start
```

## Build With Android Studio

This app uses Expo with a generated native Android project. Open `mobileapps-new/android` in Android Studio, not the `mobileapps-new` root. The root is the Expo/React Native workspace; the `android` directory is the Gradle project Android Studio expects.

If the native project ever needs to be regenerated after Expo config changes, run:

```powershell
cd mobileapps-new
npx.cmd expo prebuild --platform android --no-install
```

Then sync Gradle in Android Studio and use the generated `app` run configuration.

Set these environment variables in `.env`:

- `EXPO_PUBLIC_KLOAK_WEB_URL`: deployed web app URL, usually `https://kloak.app/app`
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: anon or publishable key
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Expo/EAS project id used to mint Expo push tokens

If you do not have an EAS project id yet, run this once from `mobileapps-new`:

```powershell
npx eas init
```

Then copy the generated project id into `.env` as `EXPO_PUBLIC_EAS_PROJECT_ID`.

## Push Flow

The native shell registers an Expo push token. After the web app is loaded and the user is signed in, the shell injects a small same-origin script into the WebView. That script reads Kloak's existing encrypted-auth fallback, restores the current user through Supabase using `x-key-hash`, and upserts the native push token into `public.push_tokens`.

Notification taps route the WebView to the link sent in the notification payload, such as:

- `/app/servers/:serverId/channels/:channelId?message=:messageId`
- `/app?conversation=:conversationId`
- `/app/friends`

## Push Troubleshooting

If the app opens but the phone does not receive pushes:

1. Make sure `.env` has `EXPO_PUBLIC_EAS_PROJECT_ID`. Without it the app cannot call `getExpoPushTokenAsync`.
2. Apply the Supabase migration that grants anon access to `public.push_tokens` under RLS:
   `supabase/migrations/20260715110000_allow_mobile_anon_push_token_registration.sql`
3. Log in on the phone and wait a few seconds. If the bottom pill says `Push: not-authenticated`, the shell has the native token but the web session is not ready yet; it retries automatically.
4. Confirm a row exists in `public.push_tokens` for the logged-in user with `enabled = true`.
5. Test on a physical device using an Expo development build or production build. Remote push notifications do not work in Expo Go on Android from SDK 53 onward, so Expo Go is not a reliable push test surface.
