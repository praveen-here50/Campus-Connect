import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { AuthResponse, UserProfile } from './types'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (fullName: string, email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: UserProfile) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)
  const queryClient = useQueryClient()

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return
    api
      .get<UserProfile>('/api/users/me')
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [logout])

  const accept = useCallback((res: AuthResponse) => {
    setToken(res.token)
    setUser(res.user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => accept(await api.post<AuthResponse>('/api/auth/login', { email, password })),
      register: async (fullName, email, password) =>
        accept(await api.post<AuthResponse>('/api/auth/register', { fullName, email, password })),
      logout,
      setUser,
    }),
    [user, loading, accept, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** For screens behind the login, where the user is always loaded. */
// oxlint-disable-next-line react/only-export-components
export function useMe(): UserProfile {
  const { user } = useAuth()
  if (!user) throw new Error('useMe used outside a signed-in screen')
  return user
}
