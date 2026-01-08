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
  
  // Actions
  setUser: (user: User | null) => void;
  setSecretKey: (key: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Auth methods
  checkAuth: () => Promise<boolean>;
  createAccount: (username: string) => Promise<{ secretKey: string; user: User } | null>;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updateStatus: (status: UserStatus) => Promise<void>;
  updateLastSeen: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      secretKey: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSecretKey: (key) => set({ secretKey: key }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

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
            banner_color: (userData.banner_color as string) || '#5865F2',
            bio: userData.bio as string | null,
            status: (userData.status as UserStatus) || 'online',
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: userData.last_seen as string | null,
          };

          set({ user, secretKey, isAuthenticated: true, isLoading: false });
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
            banner_color: (userData.banner_color as string) || '#5865F2',
            bio: userData.bio as string | null,
            status: 'online',
            custom_status: userData.custom_status as string | null,
            created_at: userData.created_at as string,
            last_seen: new Date().toISOString(),
          };

          set({ user, secretKey, isAuthenticated: true, isLoading: false });
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
          const { data, error } = await supabase.rpc('update_user_profile', {
            _user_id: user.id,
            _updates: updates,
          });

          if (error) throw error;
          
          if (data) {
            const userData = data as Record<string, unknown>;
            set({ 
              user: { 
                ...user, 
                display_name: userData.display_name as string | null,
                bio: userData.bio as string | null,
                avatar_url: userData.avatar_url as string | null,
                banner_color: (userData.banner_color as string) || user.banner_color,
                custom_status: userData.custom_status as string | null,
              } 
            });
          } else {
            set({ user: { ...user, ...updates } });
          }
        } catch (error) {
          console.error('Failed to update user:', error);
        }
      },

      updateStatus: async (status) => {
        const { user } = get();
        if (!user) return;

        try {
          await supabase.rpc('update_user_status', {
            _user_id: user.id,
            _status: status,
          });

          set({ user: { ...user, status } });
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
    }),
    {
      name: 'nomo-auth',
      partialize: (state) => ({ secretKey: state.secretKey }),
    }
  )
);

// Initialize auth on app load
export const initializeAuth = async () => {
  const { checkAuth } = useAuthStore.getState();
  await checkAuth();
};