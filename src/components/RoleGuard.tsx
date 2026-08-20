import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requireApproval?: boolean
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  requireApproval = true,
}) => {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37] mb-4" />
        <p className="text-sm text-gray-400 font-inter">Carregando 369TRAINING...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role verification
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="p-4 rounded-full bg-red-950/40 border border-red-500/30 mb-4">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold font-montserrat text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400 max-w-md mb-6 font-inter text-sm">
          Seu perfil ({user.role}) não tem permissão para acessar este módulo do sistema
          369TRAINING.
        </p>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              if (user.role === 'admin') window.location.href = '/admin'
              else if (user.role === 'profissional') window.location.href = '/profissional'
              else window.location.href = '/aluno'
            }}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-semibold"
          >
            Ir para meu Painel
          </Button>
          <Button
            variant="outline"
            onClick={logout}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Sair da Conta
          </Button>
        </div>
      </div>
    )
  }

  // Approval verification for professionals
  if (user.role === 'profissional' && requireApproval && !user.approved) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="p-4 rounded-full bg-amber-950/40 border border-amber-500/30 mb-4">
          <ShieldAlert className="w-12 h-12 text-[#D4AF37]" />
        </div>
        <h2 className="text-2xl font-bold font-montserrat text-white mb-2">Perfil em Análise</h2>
        <p className="text-gray-400 max-w-lg mb-6 font-inter text-sm leading-relaxed">
          Olá, <span className="text-white font-semibold">{user.name}</span>! Seu cadastro como
          profissional está sendo auditado pela equipe 369TRAINING. Seus documentos e registro
          profissional estão em fase de validação para garantia de segurança dos alunos.
        </p>
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 max-w-md w-full mb-6 text-left text-xs text-gray-400 space-y-2">
          <div className="flex justify-between">
            <span>Registro:</span>
            <span className="text-white font-mono">{user.cref || 'Em análise'}</span>
          </div>
          <div className="flex justify-between">
            <span>Especialidades:</span>
            <span className="text-white">{user.specialties?.join(', ') || 'Geral'}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="text-amber-400 font-semibold">Pendente de Aprovação</span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={logout}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Sair da Conta
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
