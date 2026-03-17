import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getKeyHash, supabase, setKeyHashHeader } from "@/integrations/supabase/client";
import { generateSecretKey, hashSecretKey, isValidSecretKey } from "@/lib/crypto";
import { authRateLimiter, accountCreationRateLimiter, validateUsername } from "@/lib/security";
import { useUserCacheStore } from "@/stores/userCacheStore";
import type { User, UserStatus } from "@/types";
let lastSeenTimestamp = 0;
// Presence/status is not critical to be realtime; debounce + coalesce AUTO status updates
// to avoid spamming `update_user_status` during tab switches/activity bursts.
const AUTO_STATUS_RPC_DELAY_MS = 90_000; // ~1.5 minutes
let autoStatusTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAutoStatus: UserStatus | null = null;
let pendingAutoUserId: string | null = null;
const statusInFlight = new Map<UserStatus, Promise<void>>();
const LAST_SEEN_INTERVAL = 60_000; // 60 seconds minimum between calls
const LAST_SEEN_STORAGE_PREFIX = "kloak:last-seen:";
let initializeAuthInFlight: Promise<void> | null = null;

// One-time migration: remove raw secretKey from localStorage if present
const clearLegacySecretKey = () => {
  try {
    const raw = localStorage.getItem('kloak-auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state?.secretKey) {
      delete parsed.state.secretKey;
      localStorage.setItem('kloak-auth', JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
};
clearLegacySecretKey();

interface AuthState {
  user: User | null;
  secretKey: string | null;
  /**
   * Persisted SHA-256 hash of the secret key.
   * Used to (re)apply the x-key-hash header immediately on refresh/HMR.
   */
  keyHash: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isNewUser: boolean;
  /**
   * Manual status chosen by the user (e.g. Invisible / DND).
   * Persisted to survive restarts and avoid treating stale DB "offline" as intentional Invisible.
   */
  manualStatus: UserStatus | null;

  // Actions
  setUser: (user: User | null) => void;
  setSecretKey: (key: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsNewUser: (isNew: boolean) => void;

  // Auth methods
  checkAuth: () => Promise<boolean>;
  createAccount: (username: string, hcaptchaResponse: string) => Promise<{ secretKey: string; user: User } | null>;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updateStatus: (status: UserStatus, options?: { source?: "manual" | "auto" }) => Promise<void>;
  updateLastSeen: () => Promise<void>;
  resetSecretKey: () => Promise<
    { newSecretKey: string } | { error: string; cooldownEndsAt?: string; hoursRemaining?: number } | null
  >;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      secretKey: null,
      keyHash: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isNewUser: false,
      manualStatus: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSecretKey: (key) => set({ secretKey: key }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setIsNewUser: (isNew) => set({ isNewUser: isNew }),

      checkAuth: async () => {
        const { keyHash } = get();
        if (!keyHash) {
          set({ isAuthenticated: false, user: null, keyHash: null });
          setKeyHashHeader(null);
          return false;
        }

        // Use persisted keyHash directly — no need for raw secretKey
        setKeyHashHeader(keyHash);
        set({ isLoading: true });

        try {
          const { data, error } = await supabase.rpc("login_user", {
            _key_hash: keyHash,
          });

          if (error || !data) {
            setKeyHashHeader(null);
            set({ isAuthenticated: false, user: null, keyHash: null, isLoading: false });
            return false;
          }

          const userData = data as Record<string, unknown>;
          const user: User = {
            id: userData.id as string,
            username: userData.username as string,
            display_name: userData.display_name as string | null,
            avatar_url: userData.avatar_url as string | null,
            banner_url: (userData.banner_url as string | null) ?? null,
            avatar_decoration: userData.avatar_decoration as string | null,
            profile_effect: (userData.profile_effect as string | null) ?? null,
            banner_color: (userData.banner_color as string) || "#5865F2",
            profile_theme_primary: (userData.profile_theme_primary as string | null) ?? null,
            profile_theme_accent: (userData.profile_theme_accent as string | null) ?? null,
            bio: userData.bio as string | null,
            status: "online",
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: new Date().toISOString(),
            pronouns: (userData.pronouns as string | null) ?? null,
            is_bot: (userData.is_bot as boolean | null) ?? false,
          };

          set({ user, isAuthenticated: true, isLoading: false });
          useUserCacheStore.getState().upsertUser(user);
          return true;
        } catch (error) {
          console.error("checkAuth error:", error);
          setKeyHashHeader(null);
          set({ isAuthenticated: false, user: null, keyHash: null, isLoading: false });
          return false;
        }
      },

      createAccount: async (username: string, hcaptchaResponse?: string) => {
        set({ isLoading: true, error: null });

        // Rate limit account creation to prevent abuse
        // Use a global key since we don't have a user ID yet
        const rateLimitKey = `create_${username.toLowerCase().trim()}`;
        if (!accountCreationRateLimiter.isAllowed(rateLimitKey)) {
          const remainingTime = accountCreationRateLimiter.getRemainingTime(rateLimitKey);
          set({ error: `Too many attempts. Try again in ${Math.ceil(remainingTime / 60)} minutes`, isLoading: false });
          return null;
        }

        // Validate username
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
          set({ error: usernameValidation.error, isLoading: false });
          return null;
        }

        try {
          if (!hcaptchaResponse) {
            set({ error: "Captcha verification is required.", isLoading: false });
            return null;
          }

          const secretKey = generateSecretKey();
          const keyHash = await hashSecretKey(secretKey);
          const normalizedUsername = username.toLowerCase().trim();
          const bannerColor = "#5865F2";

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            set({ error: "Registration is not configured. Missing VITE_SUPABASE_URL.", isLoading: false });
            return null;
          }

          let data: Record<string, unknown> | null = null;
          let errorMessage: string | null = null;
          let res: Response;
          try {
            res = await fetch(`${supabaseUrl}/functions/v1/register-with-captcha`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: normalizedUsername,
                key_hash: keyHash,
                hcaptcha_response: hcaptchaResponse,
                banner_color: bannerColor,
              }),
            });
          } catch (fetchError) {
            const msg = fetchError instanceof Error ? fetchError.message : "Network request failed";
            set({
              error: "Registration service unavailable. Please try again later.",
              isLoading: false,
            });
            console.error("Registration fetch failed:", msg);
            return null;
          }

          let json: { data?: Record<string, unknown>; error?: string } = {};
          const responseText = await res.text();
          if (responseText) {
            try {
              json = JSON.parse(responseText) as { data?: Record<string, unknown>; error?: string };
            } catch {
              json = {
                error: `Registration failed with HTTP ${res.status}. Non-JSON response from edge function.`,
              };
            }
          }

          if (!res.ok) {
            errorMessage = json.error ?? "Registration failed";
          } else {
            data = json.data ?? null;
          }

          if (errorMessage) {
            if (errorMessage.includes("Username already taken")) {
              set({ error: "Username already taken", isLoading: false });
              return null;
            }
            if (errorMessage.includes("reserved") || errorMessage.includes("not allowed")) {
              set({ error: "This username is not allowed", isLoading: false });
              return null;
            }
            set({ error: errorMessage, isLoading: false });
            return null;
          }

          if (!data) {
            throw new Error("No user data returned");
          }

          const userData = data;
          const user: User = {
            id: userData.id as string,
            username: userData.username as string,
            display_name: userData.display_name as string | null,
            avatar_url: userData.avatar_url as string | null,
            banner_url: (userData.banner_url as string | null) ?? null,
            avatar_decoration: userData.avatar_decoration as string | null,
            profile_effect: (userData.profile_effect as string | null) ?? null,
            banner_color: (userData.banner_color as string) || "#5865F2",
            profile_theme_primary: (userData.profile_theme_primary as string | null) ?? null,
            profile_theme_accent: (userData.profile_theme_accent as string | null) ?? null,
            bio: userData.bio as string | null,
            status: (userData.status as UserStatus) || "online",
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: userData.last_seen as string | null,
            pronouns: (userData.pronouns as string | null) ?? null,
            is_bot: (userData.is_bot as boolean | null) ?? false,
          };

          // New account starts with no manual status override.
          const newKeyHash = await hashSecretKey(secretKey);
          setKeyHashHeader(newKeyHash);
          set({
            user,
            secretKey,
            keyHash: newKeyHash,
            isAuthenticated: true,
            isLoading: false,
            isNewUser: true,
            manualStatus: null,
          });
          // Seed user cache to avoid immediate redundant get_user_by_id calls (realtime / DMs).
          useUserCacheStore.getState().upsertUser(user);

          return { secretKey, user };
        } catch (error) {
          console.error("Registration error:", error);
          set({ error: "Failed to register. Please try again.", isLoading: false });
          return null;
        }
      },

      login: async (secretKey: string) => {
        set({ isLoading: true, error: null });

        if (!isValidSecretKey(secretKey)) {
          set({ error: "Invalid secret key format", isLoading: false });
          return false;
        }

        // Rate limiting check - use a hash of the key prefix to avoid logging the full key
        const rateLimitKey = `login_${secretKey.slice(0, 8)}`;
        if (!authRateLimiter.isAllowed(rateLimitKey)) {
          const remaining = authRateLimiter.getRemainingTime(rateLimitKey);
          set({ error: `Too many attempts. Try again in ${remaining} seconds.`, isLoading: false });
          return false;
        }

        try {
          const keyHash = await hashSecretKey(secretKey);

          // Set the key_hash header for identity verification on all subsequent requests
          setKeyHashHeader(keyHash);
          set({ keyHash });

          // Use RPC function to login (bypasses RLS)
          const { data, error } = await supabase.rpc("login_user", {
            _key_hash: keyHash,
          });

          if (error) {
            const message = error.message || "";
            const normalizedMessage =
              message.includes("Rate limited:")
                ? message
                : message.includes("permission denied") || message.includes("forbidden")
                  ? "Login service is temporarily unavailable."
                  : "Failed to login. Please try again.";
            setKeyHashHeader(null);
            set({ error: normalizedMessage, isLoading: false, isAuthenticated: false, keyHash: null });
            return false;
          }
          if (!data) {
            setKeyHashHeader(null);
            set({ error: "Invalid secret key", isLoading: false, isAuthenticated: false, keyHash: null });
            return false;
          }

          const userData = data as Record<string, unknown>;
          const user: User = {
            id: userData.id as string,
            username: userData.username as string,
            display_name: userData.display_name as string | null,
            avatar_url: userData.avatar_url as string | null,
            banner_url: (userData.banner_url as string | null) ?? null,
            avatar_decoration: userData.avatar_decoration as string | null,
            profile_effect: (userData.profile_effect as string | null) ?? null,
            banner_color: (userData.banner_color as string) || "#5865F2",
            profile_theme_primary: (userData.profile_theme_primary as string | null) ?? null,
            profile_theme_accent: (userData.profile_theme_accent as string | null) ?? null,
            bio: userData.bio as string | null,
            status: "online",
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: new Date().toISOString(),
            pronouns: (userData.pronouns as string | null) ?? null,
            is_bot: (userData.is_bot as boolean | null) ?? false,
          };

          set({ user, isAuthenticated: true, isLoading: false, manualStatus: null });
          // Seed user cache to avoid redundant get_user_by_id calls (realtime / DMs).
          useUserCacheStore.getState().upsertUser(user);

          return true;
        } catch (error) {
          console.error("Login error:", error);
          set({ error: "Failed to login. Please try again.", isLoading: false });
          return false;
        }
      },

      logout: () => {
        const { user } = get();
        if (user) {
          supabase
            .rpc("update_user_status", {
              _user_id: user.id,
              _status: "offline",
            })
            .then(() => {});
          useUserCacheStore.getState().invalidate(user.id);
        }
        setKeyHashHeader(null);
        set({ user: null, secretKey: null, keyHash: null, isAuthenticated: false, error: null });
      },

      updateUser: async (updates) => {
        const { user } = get();
        if (!user) return;

        try {
          // Normalize empty strings to null for custom_status
          const normalizedUpdates = { ...updates };
          if ("custom_status" in normalizedUpdates && normalizedUpdates.custom_status === "") {
            normalizedUpdates.custom_status = null;
          }

          const { data, error } = await supabase.functions.invoke("update-user-profile", {
            body: { updates: normalizedUpdates },
          });

          if (error) throw error;

          if (data) {
            const userData = data as Record<string, unknown>;

            // Build the updated user object, respecting explicit null values from normalizedUpdates
            const updatedUser = {
              ...user,
              display_name:
                "display_name" in normalizedUpdates
                  ? (normalizedUpdates.display_name as string | null)
                  : ((userData.display_name as string | null) ?? user.display_name),
              bio:
                "bio" in normalizedUpdates
                  ? (normalizedUpdates.bio as string | null)
                  : ((userData.bio as string | null) ?? user.bio),
              avatar_url:
                "avatar_url" in normalizedUpdates
                  ? (normalizedUpdates.avatar_url as string | null)
                  : ((userData.avatar_url as string | null) ?? user.avatar_url),
              banner_url:
                "banner_url" in normalizedUpdates
                  ? (normalizedUpdates.banner_url as string | null)
                  : ((userData.banner_url as string | null) ?? user.banner_url),
              avatar_decoration:
                "avatar_decoration" in normalizedUpdates
                  ? (normalizedUpdates.avatar_decoration as string | null)
                  : ((userData.avatar_decoration as string | null) ?? user.avatar_decoration),
              profile_effect:
                "profile_effect" in normalizedUpdates
                  ? (normalizedUpdates.profile_effect as string | null)
                  : ((userData.profile_effect as string | null) ?? user.profile_effect),
              banner_color:
                "banner_color" in normalizedUpdates
                  ? (normalizedUpdates.banner_color as string)
                  : (userData.banner_color as string) || user.banner_color,
              profile_theme_primary:
                "profile_theme_primary" in normalizedUpdates
                  ? (normalizedUpdates.profile_theme_primary as string | null)
                  : ((userData.profile_theme_primary as string | null) ?? user.profile_theme_primary),
              profile_theme_accent:
                "profile_theme_accent" in normalizedUpdates
                  ? (normalizedUpdates.profile_theme_accent as string | null)
                  : ((userData.profile_theme_accent as string | null) ?? user.profile_theme_accent),
              custom_status:
                "custom_status" in normalizedUpdates
                  ? (normalizedUpdates.custom_status as string | null)
                  : ((userData.custom_status as string | null) ?? user.custom_status),
              pronouns:
                "pronouns" in normalizedUpdates
                  ? (normalizedUpdates.pronouns as string | null)
                  : ((userData.pronouns as string | null) ?? user.pronouns),
              is_bot: (userData.is_bot as boolean | null) ?? user.is_bot ?? false,
            };

            set({ user: updatedUser });
            useUserCacheStore.getState().upsertUser(updatedUser as any);
          } else {
            const updatedUser = { ...user, ...normalizedUpdates };
            set({ user: updatedUser });
            useUserCacheStore.getState().upsertUser(updatedUser as any);
          }
        } catch (error) {
          console.error("Failed to update user:", error);
        }
      },

      updateStatus: async (status, options) => {
        const { user } = get();
        if (!user) return;

        try {
          const source = options?.source ?? "manual";

          // Avoid spamming `update_user_status` on tab switches / activity bursts.
          // - If status is already set locally, no-op (for both manual/auto).
          // - For auto updates, delay + coalesce RPC (only send the final status after a short window).
          if (user.status === status) {
            return;
          }

          const currentManualStatus = get().manualStatus;

          // Track manual status for DND/Invisible so they persist across sessions
          // Clear manualStatus when user explicitly goes online or idle
          let nextManualStatus: UserStatus | null;
          if (source === "manual") {
            if (status === "offline" || status === "dnd") {
              nextManualStatus = status;
            } else {
              // User explicitly chose online or idle - clear any manual override
              nextManualStatus = null;
            }
          } else {
            // Auto status changes don't affect manualStatus
            nextManualStatus = currentManualStatus;
          }

          // Always update local state immediately (UI responsiveness),
          // but for AUTO updates delay the server RPC.
          set({ user: { ...user, status }, manualStatus: nextManualStatus });

          if (source === "manual") {
            // Manual changes should go to server immediately and also cancel any pending auto update.
            pendingAutoStatus = null;
            pendingAutoUserId = null;
            if (autoStatusTimer) {
              clearTimeout(autoStatusTimer);
              autoStatusTimer = null;
            }

            await supabase.rpc("update_user_status", {
              _user_id: user.id,
              _status: status,
            });
            return;
          }

          // AUTO: coalesce multiple status changes into one RPC after delay.
          pendingAutoStatus = status;
          pendingAutoUserId = user.id;
          if (autoStatusTimer) clearTimeout(autoStatusTimer);

          autoStatusTimer = setTimeout(async () => {
            const uId = pendingAutoUserId;
            const st = pendingAutoStatus;
            pendingAutoUserId = null;
            pendingAutoStatus = null;
            autoStatusTimer = null;

            if (!uId || !st) return;

            // If user logged out or local status changed since scheduling, skip.
            const current = useAuthStore.getState().user;
            if (!current || current.id !== uId) return;
            if (current.status !== st) return;

            const inflight = statusInFlight.get(st);
            if (inflight) return;

            const p: Promise<void> = Promise.resolve(supabase.rpc("update_user_status", { _user_id: uId, _status: st }))
              .then(() => undefined)
              .finally(() => {
                const cur = statusInFlight.get(st);
                if (cur === p) statusInFlight.delete(st);
              });

            statusInFlight.set(st, p);
            await p;
          }, AUTO_STATUS_RPC_DELAY_MS);
        } catch (error) {
          console.error("Failed to update status:", error);
        }
      },

      updateLastSeen: async () => {
        const { user } = get();
        if (!user) return;

        const persistedLastSeen =
          typeof window !== "undefined"
            ? Number(window.sessionStorage.getItem(`${LAST_SEEN_STORAGE_PREFIX}${user.id}`) ?? 0)
            : 0;

        if (persistedLastSeen > lastSeenTimestamp) {
          lastSeenTimestamp = persistedLastSeen;
        }

        // Throttle: skip if called within the last 60 seconds
        const now = Date.now();
        if (now - lastSeenTimestamp < LAST_SEEN_INTERVAL) return;
        lastSeenTimestamp = now;
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem(`${LAST_SEEN_STORAGE_PREFIX}${user.id}`, String(now));
          } catch {
            // ignore storage failures
          }
        }

        try {
          await supabase.rpc("update_user_last_seen", {
            _user_id: user.id,
          });
        } catch (error) {
          console.error("Failed to update last seen:", error);
        }
      },

      resetSecretKey: async () => {
        const { user } = get();
        if (!user) return null;

        try {
          // Generate a new secret key
          const newSecretKey = generateSecretKey();
          const newKeyHash = await hashSecretKey(newSecretKey);

          // Use the RPC function with cooldown enforcement
          const { data, error } = await supabase.rpc("reset_user_secret_key", {
            _user_id: user.id,
            _new_key_hash: newKeyHash,
          });

          if (error) throw error;

          // Check if cooldown is active
          const result = data as {
            success: boolean;
            error?: string;
            cooldown_ends_at?: string;
            hours_remaining?: number;
          };
          if (!result.success && result.error === "cooldown") {
            return {
              error: "cooldown",
              cooldownEndsAt: result.cooldown_ends_at,
              hoursRemaining: result.hours_remaining,
            };
          }

          // Update local state with the new key
          setKeyHashHeader(newKeyHash);
          set({ secretKey: newSecretKey, keyHash: newKeyHash });

          return { newSecretKey };
        } catch (error) {
          console.error("Failed to reset secret key:", error);
          return null;
        }
      },
    }),
    {
      name: "kloak-auth",
      partialize: (state) => ({ secretKey: state.secretKey, keyHash: state.keyHash, manualStatus: state.manualStatus }),
      onRehydrateStorage: () => (state) => {
        // Ensure x-key-hash header is applied ASAP after hydration.
        // This prevents secured RPCs from failing with identity mismatch after refresh/HMR.
        try {
          setKeyHashHeader(state?.keyHash ?? null);
        } catch {
          // ignore
        }
      },
    },
  ),
);

// Initialize auth on app load
export const initializeAuth = async () => {
  const { checkAuth, isAuthenticated, isLoading, secretKey } = useAuthStore.getState();
  if (!secretKey) return;
  if (isAuthenticated && !isLoading) return;
  if (initializeAuthInFlight) return initializeAuthInFlight;

  initializeAuthInFlight = (async () => {
    await checkAuth();
  })().finally(() => {
    initializeAuthInFlight = null;
  });

  return initializeAuthInFlight;
};
