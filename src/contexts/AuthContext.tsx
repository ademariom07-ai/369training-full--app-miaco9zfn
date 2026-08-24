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
      const authData = await pb.collection('users').authWithPassword(email, pass)
      return authData.record as unknown as UserProfile
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401) {
        throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.')
      }
      if (err?.status === 0 || (err?.name === 'ClientResponseError' && !err?.status)) {
        throw new Error('Servidor indisponível. Tente novamente.')
      }
      throw new Error(err?.message || 'Servidor indisponível. Tente novamente.')
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
