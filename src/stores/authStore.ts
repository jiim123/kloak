import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { generateSecretKey, hashSecretKey, isValidSecretKey } from '@/lib/crypto';
import { authRateLimiter, validateUsername } from '@/lib/security';
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
        
        // Validate username
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
          set({ error: usernameValidation.error, isLoading: false });
          return null;
        }
        
        try {
          const secretKey = generateSecretKey();
          const keyHash = await hashSecretKey(secretKey);

          const { data, error } = await supabase
            .from('users')
            .insert({
              username: username.toLowerCase().trim(),
              key_hash: keyHash,
              status: 'online',
              banner_color: '#5865F2',
            })
            .select()
            .single();

          if (error) {
            if (error.code === '23505') {
              set({ error: 'Username already taken', isLoading: false });
              return null;
            }
            throw error;
          }

          const user: User = {
            id: data.id,
            username: data.username,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            banner_color: data.banner_color || '#5865F2',
            bio: data.bio,
            status: data.status as UserStatus,
            custom_status: data.custom_status,
            created_at: data.created_at,
            last_seen: data.last_seen,
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

          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('key_hash', keyHash)
            .single();

          if (error || !data) {
            set({ error: 'Invalid secret key', isLoading: false, isAuthenticated: false });
            return false;
          }

          // Update last_seen and status
          await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString(), status: 'online' })
            .eq('id', data.id);

          const user: User = {
            id: data.id,
            username: data.username,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            banner_color: data.banner_color || '#5865F2',
            bio: data.bio,
            status: 'online',
            custom_status: data.custom_status,
            created_at: data.created_at,
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
          supabase
            .from('users')
            .update({ status: 'offline', last_seen: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {});
        }
        set({ user: null, secretKey: null, isAuthenticated: false, error: null });
      },

      updateUser: async (updates) => {
        const { user } = get();
        if (!user) return;

        try {
          const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', user.id);

          if (error) throw error;
          set({ user: { ...user, ...updates } });
        } catch (error) {
          console.error('Failed to update user:', error);
        }
      },

      updateStatus: async (status) => {
        const { user } = get();
        if (!user) return;

        try {
          await supabase
            .from('users')
            .update({ status })
            .eq('id', user.id);

          set({ user: { ...user, status } });
        } catch (error) {
          console.error('Failed to update status:', error);
        }
      },

      updateLastSeen: async () => {
        const { user } = get();
        if (!user) return;

        const now = new Date().toISOString();
        try {
          await supabase
            .from('users')
            .update({ last_seen: now })
            .eq('id', user.id);

          set({ user: { ...user, last_seen: now } });
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