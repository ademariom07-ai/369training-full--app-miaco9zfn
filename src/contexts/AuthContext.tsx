import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type UserRole = 'aluno' | 'profissional' | 'admin'
export type PlanTier = 'gratis' | 'basico' | 'pro' | 'premium'

export interface UserProfile extends RecordModel {
  email: string
  name: string
  role: UserRole
  plan: PlanTier
  plan_type: 'aluno' | 'profissional'
  approved: boolean
  bio?: string
  cref?: string
  specialties?: string[]
  latitude?: number
  longitude?: number
  city?: string
  state?: string
  address?: string
  phone?: string
  rating_avg?: number
  referral_code?: string
  objective?: string
  avatar?: string
  video_url?: string
  video_enabled?: boolean
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<UserProfile>
  logout: () => void
  refreshUser: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      return pb.authStore.record as unknown as UserProfile
    }
    return null
  })
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshUser = async (): Promise<UserProfile | null> => {
    if (!pb.authStore.token) return null
    try {
      const res = await fetch('/pb/auth-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
      })
      if (!res.ok) {
        pb.authStore.clear()
        return null
      }
      const data = await res.json()
      pb.authStore.save(data.token, data.record)
      return data.record as UserProfile
    } catch (_) {
      pb.authStore.clear()
      return null
    }
  }

  useEffect(() => {
    const unsub = pb.authStore.onChange((newToken, record) => {
      setToken(newToken)
      setUser(record as unknown as UserProfile)
    })

    refreshUser().finally(() => {
      setIsLoading(false)
    })

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    try {
      const getUrl = `/api/hooks/login?e=${encodeURIComponent(email)}&p=${encodeURIComponent(pass)}`
      const getRes = await fetch(getUrl, {
        method: 'GET',
      })

      if (getRes.ok) {
        const data = await getRes.json().catch(() => ({}))
        pb.authStore.save(data.token, data.record)
        return data.record as UserProfile
      }

      if (getRes.status === 405) {
        const postRes = await fetch('/pb/auth-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: email, password: pass }),
        })
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Falha na autenticação')
        }
        const data = await postRes.json()
        pb.authStore.save(data.token, data.record)
        return data.record as UserProfile
      }

      const err = await getRes.json().catch(() => ({}))
      throw new Error(err.error || err.message || 'Credenciais inválidas')
    } catch (err: any) {
      // If network fetch failed or thrown error
      if (err?.message && err.message !== 'Failed to fetch') {
        throw err
      }
      // Attempt fallback if GET fetch had a network error
      const postRes = await fetch('/pb/auth-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password: pass }),
      })
      if (!postRes.ok) {
        const postErr = await postRes.json().catch(() => ({}))
        throw new Error(postErr.message || postErr.error || 'Falha na autenticação')
      }
      const data = await postRes.json()
      pb.authStore.save(data.token, data.record)
      return data.record as UserProfile
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && pb.authStore.isValid,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
