import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { generateSecretKey, hashSecretKey, isValidSecretKey } from '@/lib/crypto';
import { authRateLimiter, accountCreationRateLimiter, validateUsername } from '@/lib/security';
import type { User, UserStatus } from '@/types';

interface AuthState {
  user: User | null;
  secretKey: string | null;
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
  createAccount: (username: string) => Promise<{ secretKey: string; user: User } | null>;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updateStatus: (status: UserStatus, options?: { source?: 'manual' | 'auto' }) => Promise<void>;
  updateLastSeen: () => Promise<void>;
  resetSecretKey: () => Promise<{ newSecretKey: string } | { error: string; cooldownEndsAt?: string; hoursRemaining?: number } | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      secretKey: null,
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
        const { secretKey, login } = get();
        if (!secretKey || !isValidSecretKey(secretKey)) {
          set({ isAuthenticated: false, user: null });
          return false;
        }
        
        set({ isLoading: true });
        const success = await login(secretKey);
        set({ isLoading: false });
        return success;
      },

      createAccount: async (username: string) => {
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
          const secretKey = generateSecretKey();
          const keyHash = await hashSecretKey(secretKey);

          // Use the secure RPC function to register (bypasses RLS)
          const { data, error } = await supabase
            .rpc('register_user', {
              _username: username.toLowerCase().trim(),
              _key_hash: keyHash,
              _banner_color: '#5865F2',
            });

          if (error) {
            // Handle specific error messages from the function
            if (error.message.includes('Username already taken')) {
              set({ error: 'Username already taken', isLoading: false });
              return null;
            }
            if (error.message.includes('reserved')) {
              set({ error: 'This username is reserved', isLoading: false });
              return null;
            }
            throw error;
          }
          
          if (!data) {
            throw new Error('No user data returned');
          }

          // Data is returned as JSON from the RPC function
          const userData = data as Record<string, unknown>;
          const user: User = {
            id: userData.id as string,
            username: userData.username as string,
            display_name: userData.display_name as string | null,
            avatar_url: userData.avatar_url as string | null,
            banner_url: (userData.banner_url as string | null) ?? null,
            avatar_decoration: userData.avatar_decoration as string | null,
            profile_effect: (userData.profile_effect as string | null) ?? null,
            banner_color: (userData.banner_color as string) || '#5865F2',
            profile_theme_primary: (userData.profile_theme_primary as string | null) ?? null,
            profile_theme_accent: (userData.profile_theme_accent as string | null) ?? null,
            bio: userData.bio as string | null,
            status: (userData.status as UserStatus) || 'online',
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: userData.last_seen as string | null,
           pronouns: (userData.pronouns as string | null) ?? null,
          };

          // New account starts with no manual status override.
          set({ user, secretKey, isAuthenticated: true, isLoading: false, isNewUser: true, manualStatus: null });

          // Auto-join the default community server
          try {
            await supabase.rpc('join_server_by_invite', {
              _invite_code: 'ET68T4B3',
              _user_id: user.id,
            });
          } catch (e) {
            // Non-critical — don't block registration if auto-join fails
            console.warn('Auto-join default server failed:', e);
          }

          return { secretKey, user };
        } catch (error) {
          console.error('Registration error:', error);
          set({ error: 'Failed to register. Please try again.', isLoading: false });
          return null;
        }
      },

      login: async (secretKey: string) => {
        set({ isLoading: true, error: null });
        
        if (!isValidSecretKey(secretKey)) {
          set({ error: 'Invalid secret key format', isLoading: false });
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

          // Use RPC function to login (bypasses RLS)
          const { data, error } = await supabase.rpc('login_user', {
            _key_hash: keyHash,
          });

          if (error || !data) {
            set({ error: 'Invalid secret key', isLoading: false, isAuthenticated: false });
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
            banner_color: (userData.banner_color as string) || '#5865F2',
            profile_theme_primary: (userData.profile_theme_primary as string | null) ?? null,
            profile_theme_accent: (userData.profile_theme_accent as string | null) ?? null,
            bio: userData.bio as string | null,
            status: 'online',
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: new Date().toISOString(),
           pronouns: (userData.pronouns as string | null) ?? null,
          };

          set({ user, secretKey, isAuthenticated: true, isLoading: false });

          // Re-apply a persisted manual status (e.g. Invisible/DND) on login.
          const { manualStatus } = get();
          if (manualStatus && (manualStatus === 'offline' || manualStatus === 'dnd')) {
            // Use auto to avoid mutating persisted manualStatus redundantly.
            await get().updateStatus(manualStatus, { source: 'auto' });
          }
          return true;
        } catch (error) {
          console.error('Login error:', error);
          set({ error: 'Failed to login. Please try again.', isLoading: false });
          return false;
        }
      },

      logout: () => {
        const { user } = get();
        if (user) {
          supabase.rpc('update_user_status', {
            _user_id: user.id,
            _status: 'offline',
          }).then(() => {});
        }
        set({ user: null, secretKey: null, isAuthenticated: false, error: null });
      },

      updateUser: async (updates) => {
        const { user } = get();
        if (!user) return;

        try {
          // Normalize empty strings to null for custom_status
          const normalizedUpdates = { ...updates };
          if ('custom_status' in normalizedUpdates && normalizedUpdates.custom_status === '') {
            normalizedUpdates.custom_status = null;
          }

          const { data, error } = await supabase.rpc('update_user_profile', {
            _user_id: user.id,
            _updates: normalizedUpdates,
          });

          if (error) throw error;
          
          if (data) {
            const userData = data as Record<string, unknown>;
            
            // Build the updated user object, respecting explicit null values from normalizedUpdates
            const updatedUser = { 
              ...user, 
              display_name: 'display_name' in normalizedUpdates ? normalizedUpdates.display_name as string | null : (userData.display_name as string | null) ?? user.display_name,
              bio: 'bio' in normalizedUpdates ? normalizedUpdates.bio as string | null : (userData.bio as string | null) ?? user.bio,
              avatar_url: 'avatar_url' in normalizedUpdates ? normalizedUpdates.avatar_url as string | null : (userData.avatar_url as string | null) ?? user.avatar_url,
              banner_url: 'banner_url' in normalizedUpdates ? normalizedUpdates.banner_url as string | null : (userData.banner_url as string | null) ?? user.banner_url,
              avatar_decoration: 'avatar_decoration' in normalizedUpdates ? normalizedUpdates.avatar_decoration as string | null : (userData.avatar_decoration as string | null) ?? user.avatar_decoration,
              profile_effect: 'profile_effect' in normalizedUpdates ? normalizedUpdates.profile_effect as string | null : (userData.profile_effect as string | null) ?? user.profile_effect,
              banner_color: 'banner_color' in normalizedUpdates ? normalizedUpdates.banner_color as string : (userData.banner_color as string) || user.banner_color,
              profile_theme_primary: 'profile_theme_primary' in normalizedUpdates ? normalizedUpdates.profile_theme_primary as string | null : (userData.profile_theme_primary as string | null) ?? user.profile_theme_primary,
              profile_theme_accent: 'profile_theme_accent' in normalizedUpdates ? normalizedUpdates.profile_theme_accent as string | null : (userData.profile_theme_accent as string | null) ?? user.profile_theme_accent,
              custom_status: 'custom_status' in normalizedUpdates ? normalizedUpdates.custom_status as string | null : (userData.custom_status as string | null) ?? user.custom_status,
              pronouns: 'pronouns' in normalizedUpdates ? normalizedUpdates.pronouns as string | null : (userData.pronouns as string | null) ?? user.pronouns,
            };
            
            set({ user: updatedUser });
          } else {
            set({ user: { ...user, ...normalizedUpdates } });
          }
        } catch (error) {
          console.error('Failed to update user:', error);
        }
      },

      updateStatus: async (status, options) => {
        const { user } = get();
        if (!user) return;

        try {
          await supabase.rpc('update_user_status', {
            _user_id: user.id,
            _status: status,
          });

          const source = options?.source ?? 'manual';
          const currentManualStatus = get().manualStatus;
          
          // Track manual status for DND/Invisible so they persist across sessions
          // Clear manualStatus when user explicitly goes online or idle
          let nextManualStatus: UserStatus | null;
          if (source === 'manual') {
            if (status === 'offline' || status === 'dnd') {
              nextManualStatus = status;
            } else {
              // User explicitly chose online or idle - clear any manual override
              nextManualStatus = null;
            }
          } else {
            // Auto status changes don't affect manualStatus
            nextManualStatus = currentManualStatus;
          }

          set({ user: { ...user, status }, manualStatus: nextManualStatus });
        } catch (error) {
          console.error('Failed to update status:', error);
        }
      },

      updateLastSeen: async () => {
        const { user } = get();
        if (!user) return;

        try {
          await supabase.rpc('update_user_last_seen', {
            _user_id: user.id,
          });
          // Don't update local state - this avoids triggering re-renders
          // The last_seen is only used for other users' presence display
        } catch (error) {
          console.error('Failed to update last seen:', error);
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
          const { data, error } = await supabase.rpc('reset_user_secret_key', {
            _user_id: user.id,
            _new_key_hash: newKeyHash,
          });

          if (error) throw error;

          // Check if cooldown is active
          const result = data as { success: boolean; error?: string; cooldown_ends_at?: string; hours_remaining?: number };
          if (!result.success && result.error === 'cooldown') {
            return { 
              error: 'cooldown', 
              cooldownEndsAt: result.cooldown_ends_at,
              hoursRemaining: result.hours_remaining 
            };
          }

          // Update local state with the new key
          set({ secretKey: newSecretKey });

          return { newSecretKey };
        } catch (error) {
          console.error('Failed to reset secret key:', error);
          return null;
        }
      },
    }),
    {
      name: 'kloak-auth',
      partialize: (state) => ({ secretKey: state.secretKey, manualStatus: state.manualStatus }),
    }
  )
);

// Initialize auth on app load
export const initializeAuth = async () => {
  const { checkAuth } = useAuthStore.getState();
  await checkAuth();
};