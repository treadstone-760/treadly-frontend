import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, readToken, writeToken } from '../api/client'
import type { AuthPayload, User } from '../api/types'

type RegisterInput = {
  name: string
  email: string
  password: string
  password_confirmation: string
  workspace_name?: string
  currency?: string
  timezone?: string
}

type AuthContextValue = {
  user: User | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => readToken())

  const me = useQuery({
    queryKey: ['me', token],
    enabled: Boolean(token),
    queryFn: async () => (await api.get<{ data: User }>('/auth/user')).data.data,
    retry: false,
  })

  useEffect(() => {
    if (axios.isAxiosError(me.error) && me.error.response?.status === 401) {
      writeToken(null)
      setToken(null)
    }
  }, [me.error])

  const value = useMemo<AuthContextValue>(() => {
    async function adopt(payload: AuthPayload) {
      if (!payload.token) throw new Error('The API did not return a session token.')
      writeToken(payload.token)
      setToken(payload.token)
      queryClient.setQueryData(['me', payload.token], payload.data)
    }

    return {
      user: token ? (me.data ?? null) : null,
      ready: !token || me.isFetched,
      async login(email, password) {
        const response = await api.post<AuthPayload>('/auth/login', {
          email,
          password,
          device_name: 'web',
        })
        await adopt(response.data)
      },
      async register(input) {
        const response = await api.post<AuthPayload>('/auth/register', {
          ...input,
          device_name: 'web',
          timezone: input.timezone || 'Africa/Accra',
          currency: input.currency || 'GHS',
        })
        await adopt(response.data)
      },
      async logout() {
        try {
          await api.post('/auth/logout')
        } finally {
          writeToken(null)
          setToken(null)
          queryClient.clear()
        }
      },
      async refresh() {
        await queryClient.invalidateQueries({ queryKey: ['me', token] })
      },
    }
  }, [me.data, me.isFetched, queryClient, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
