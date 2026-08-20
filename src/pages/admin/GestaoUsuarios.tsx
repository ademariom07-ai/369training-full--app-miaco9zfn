import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, Search, ShieldCheck, Ban, CheckCircle2, Lock, Edit, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'

export default function GestaoUsuarios() {
  const [usersList, setUsersList] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('todos')
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      const res = await pb.collection('users').getList<UserProfile>(1, 100, {
        sort: '-created',
      })
      setUsersList(res.items)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false))
  }, [])

  const handleToggleApproval = async (user: UserProfile) => {
    try {
      const newStatus = !user.approved
      await pb.collection('users').update(user.id, {
        approved: newStatus,
      })

      // Append audit log
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: user.id,
        action: newStatus ? 'USER_APPROVED' : 'USER_UNAPPROVED',
        details: { email: user.email, role: user.role, name: user.name },
      })

      toast.success(`Status de ${user.name} alterado para ${newStatus ? 'Aprovado' : 'Bloqueado'}!`)
      loadUsers()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao alterar status.')
    }
  }

  const filtered = usersList.filter((u) => {
    if (roleFilter !== 'todos' && u.role !== roleFilter) return false
    if (
      search &&
      !u.name?.toLowerCase().includes(search.toLowerCase()) &&
      !u.email?.toLowerCase().includes(search.toLowerCase())
    ) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <Users className="w-3.5 h-3.5" />
            Governança de Contas
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Gestão de Usuários
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Consultar, ativar, inativar, bloquear contas e auditar acessos com registro imutável
            LGPD.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none"
          >
            <option value="todos">Todos os Perfis</option>
            <option value="aluno">Apenas Alunos</option>
            <option value="profissional">Apenas Profissionais</option>
            <option value="admin">Administradores</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-10 bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* USERS TABLE */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Usuário</th>
                <th className="pb-3">Perfil</th>
                <th className="pb-3">Plano</th>
                <th className="pb-3">Cidade/UF</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#101010] border border-[#2A2A2A] flex items-center justify-center font-bold text-white font-montserrat">
                        {u.name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-white font-montserrat">{u.name}</p>
                        <p className="text-[10px] text-gray-400 font-inter">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                          : u.role === 'profissional'
                            ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                            : 'bg-[#0057FF]/10 text-[#0057FF] border border-[#0057FF]/30'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono uppercase text-gray-300">{u.plan || 'gratis'}</td>
                  <td className="py-3.5 text-gray-400">
                    {u.city || 'São Paulo'} - {u.state || 'SP'}
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.approved
                          ? 'bg-[#22C55E]/10 text-[#22C55E]'
                          : 'bg-amber-900/40 text-amber-300'
                      }`}
                    >
                      {u.approved ? 'Ativo' : 'Pendente'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <Button
                      size="sm"
                      variant={u.approved ? 'outline' : 'default'}
                      onClick={() => handleToggleApproval(u)}
                      className={`text-xs h-7 font-bold ${
                        u.approved
                          ? 'border-red-900/50 text-red-400 hover:bg-red-950/30'
                          : 'bg-[#22C55E] text-black hover:bg-[#1eb354]'
                      }`}
                    >
                      {u.approved ? 'Bloquear' : 'Aprovar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
