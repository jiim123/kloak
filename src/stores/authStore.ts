import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_color: string;
  bio: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  custom_status: string | null;
  created_at: string;
  last_seen: string;
}

interface AuthState {
  user: User | null;
  secretKey: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setSecretKey: (key: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Auth methods
  register: (username: string) => Promise<{ secretKey: string; user: User } | null>;
  login: (secretKey: string) => Promise<boolean>;
  logout: () => void;
  updateStatus: (status: User['status']) => Promise<void>;
  updateCustomStatus: (customStatus: string | null) => Promise<void>;
}

// Generate a cryptographically secure secret key
const generateSecretKey = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Hash the secret key using SHA-256
const hashSecretKey = async (secretKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      secretKey: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),
      setSecretKey: (key) => set({ secretKey: key }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      register: async (username: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Generate secret key and hash it
          const secretKey = generateSecretKey();
          const keyHash = await hashSecretKey(secretKey);

          // Insert user into database
          const { data, error } = await supabase
            .from('users')
            .insert({
              username,
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
            banner_color: data.banner_color,
            bio: data.bio,
            status: data.status as User['status'],
            custom_status: data.custom_status,
            created_at: data.created_at,
            last_seen: data.last_seen,
          };

          set({ user, secretKey, isLoading: false });
          return { secretKey, user };
        } catch (error) {
          console.error('Registration error:', error);
          set({ error: 'Failed to register. Please try again.', isLoading: false });
          return null;
        }
      },

      login: async (secretKey: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const keyHash = await hashSecretKey(secretKey);

          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('key_hash', keyHash)
            .single();

          if (error || !data) {
            set({ error: 'Invalid secret key', isLoading: false });
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
            banner_color: data.banner_color,
            bio: data.bio,
            status: 'online',
            custom_status: data.custom_status,
            created_at: data.created_at,
            last_seen: new Date().toISOString(),
          };

          set({ user, secretKey, isLoading: false });
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
          // Update status to offline
          supabase
            .from('users')
            .update({ status: 'offline', last_seen: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {});
        }
        set({ user: null, secretKey: null, error: null });
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

      updateCustomStatus: async (customStatus) => {
        const { user } = get();
        if (!user) return;

        try {
          await supabase
            .from('users')
            .update({ custom_status: customStatus })
            .eq('id', user.id);

          set({ user: { ...user, custom_status: customStatus } });
        } catch (error) {
          console.error('Failed to update custom status:', error);
        }
      },
    }),
    {
      name: 'nomo-auth',
      partialize: (state) => ({ secretKey: state.secretKey }),
    }
  )
);

// Auto-login on app load if secretKey exists
export const initializeAuth = async () => {
  const { secretKey, login, setLoading } = useAuthStore.getState();
  if (secretKey) {
    setLoading(true);
    await login(secretKey);
  }
};