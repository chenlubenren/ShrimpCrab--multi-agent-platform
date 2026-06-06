import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

const TOKEN_KEY = 'lobster_auth_token';
const USER_KEY = 'lobster_auth_user';

interface AuthStore {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;

  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      hasHydrated: false,
      error: null,

      setAuth: (token, user) =>
        set({ token, user, isLoading: false, error: null }),

      logout: () =>
        set({ token: null, user: null, error: null }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setHasHydrated: (hasHydrated) =>
        set({ hasHydrated }),

      setError: (error) =>
        set({ error, isLoading: false }),

      clearError: () =>
        set({ error: null }),
    }),
    {
      name: 'lobster-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
