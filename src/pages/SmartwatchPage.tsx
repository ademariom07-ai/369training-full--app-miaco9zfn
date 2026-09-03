import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { SmartwatchDashboard } from '@/components/SmartwatchDashboard'

export default function SmartwatchPage() {
  const { user } = useAuth()
  const userRole = (user?.role as 'aluno' | 'profissional') || 'aluno'
  const userPlan = (user?.plan as string) || 'gratis'

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <SmartwatchDashboard userRole={userRole} userPlan={userPlan} />
    </div>
  )
}
