import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Users,
  Search,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Lock,
  Edit,
  Loader2,
  Video,
  PlayCircle,
  Star,
  MapPin,
  Phone,
  Calendar as CalendarIcon,
  Eye,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'
import { PresentationVideoPlayer } from '@/components/PresentationVideoPlayer'

export default function GestaoUsuarios() {
  const [usersList, setUsersList] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [updatingVideo, setUpdatingVideo] = useState(false)

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
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, approved: newStatus })
      }
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao alterar status.')
    }
  }

  const handleToggleVideoApproval = async (user: UserProfile) => {
    setUpdatingVideo(true)
    try {
      const newVideoState = !user.video_enabled
      await pb.collection('users').update(user.id, {
        video_enabled: newVideoState,
      })

      // Append audit log
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: user.id,
        action: newVideoState ? 'VIDEO_APPROVED' : 'VIDEO_SUSPENDED',
        details: { email: user.email, name: user.name, video_url: user.video_url },
      })

      toast.success(
        `Vídeo de ${user.name} foi ${newVideoState ? 'liberado/ativado' : 'suspenso/desativado'} com sucesso!`,
      )
      loadUsers()
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, video_enabled: newVideoState })
      }
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao atualizar status do vídeo.')
    } finally {
      setUpdatingVideo(false)
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
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                <th className="pb-3">Vídeo de Apresentação</th>
                <th className="pb-3">Cidade/UF</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.map((u) => {
                const isProf = u.role === 'profissional'
                const hasVideoUrl = Boolean(u.video_url && u.video_url.trim())
                const isVideoActive = isProf && hasVideoUrl && u.video_enabled

                return (
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
                    <td className="py-3.5 font-mono uppercase text-gray-300">
                      {u.plan || 'gratis'}
                    </td>
                    <td className="py-3.5">
                      {isProf ? (
                        isVideoActive ? (
                          <button
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            title="Clique para ver o perfil e gerenciar o vídeo"
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/25 transition-colors cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                            <Video className="w-3 h-3" />
                            Vídeo Ativo
                          </button>
                        ) : hasVideoUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            title="Clique para assistir e aprovar o vídeo"
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-900/50 transition-colors cursor-pointer animate-pulse"
                          >
                            <Video className="w-3 h-3" />
                            Vídeo Pendente
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-800/60 border border-gray-700 text-gray-400">
                            Sem Vídeo
                          </span>
                        )
                      ) : (
                        <span className="text-gray-600 text-[11px]">—</span>
                      )}
                    </td>
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedUser(u)}
                          className="text-xs h-7 px-2.5 text-gray-300 hover:text-white hover:bg-white/5 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver Perfil
                        </Button>
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL AUDITORIA DE PERFIL DO USUÁRIO & VÍDEO DO PROFISSIONAL */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-5 sm:p-8 max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#101010] border-2 border-[#D4AF37] flex items-center justify-center font-bold text-xl text-white font-montserrat shrink-0">
                    {selectedUser.name?.[0] || 'U'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-xl font-bold font-montserrat text-white">
                        {selectedUser.name}
                      </DialogTitle>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          selectedUser.role === 'admin'
                            ? 'bg-red-950/40 text-red-400 border-red-500/30'
                            : selectedUser.role === 'profissional'
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                              : 'bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF]'
                        }`}
                      >
                        {selectedUser.role}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          selectedUser.approved
                            ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30'
                            : 'bg-amber-900/40 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {selectedUser.approved ? 'Conta Ativa' : 'Aprovação Pendente'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 font-inter">{selectedUser.email}</p>

                    {selectedUser.role === 'profissional' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-inter pt-1">
                        <span className="text-[#0057FF] font-semibold">
                          {selectedUser.specialties?.length
                            ? selectedUser.specialties.join(' • ')
                            : 'Educação Física'}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[#D4AF37]">
                          {selectedUser.cref || 'Registro não informado'}
                        </span>
                        <span>•</span>
                        <span className="uppercase text-gray-300">
                          Plano: <strong>{selectedUser.plan || 'basico'}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* SEÇÃO DO VÍDEO DE APRESENTAÇÃO (Se for profissional) */}
              {selectedUser.role === 'profissional' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#181818] border border-[#2A2A2A] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2A2A2A]">
                    <div className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-[#D4AF37]" />
                      <div>
                        <h4 className="text-xs font-bold uppercase text-white font-montserrat">
                          Vídeo de Apresentação do Profissional
                        </h4>
                        <p className="text-[11px] text-gray-400 font-inter">
                          Pitch de 30 segundos exibido no feed para os alunos.
                        </p>
                      </div>
                    </div>

                    {/* Badge de Status do Vídeo */}
                    <div>
                      {selectedUser.video_url && selectedUser.video_url.trim() ? (
                        selectedUser.video_enabled ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                            Vídeo Ativo (Liberado)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-950/40 border border-amber-500/40 text-amber-300">
                            Vídeo Pendente / Suspenso
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-gray-800 border border-gray-700 text-gray-400">
                          Sem Vídeo Cadastrado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Player ou Aviso */}
                  {selectedUser.video_url && selectedUser.video_url.trim() ? (
                    <div className="space-y-4">
                      {/* Player de Vídeo */}
                      <PresentationVideoPlayer
                        url={selectedUser.video_url}
                        profName={selectedUser.name}
                      />

                      {/* Card de Controle de Aprovação do Vídeo */}
                      <div className="p-4 rounded-xl bg-[#141414] border border-[#2A2A2A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="text-xs space-y-1">
                          <span className="text-gray-400 block text-[10px] uppercase font-montserrat font-bold">
                            URL do Vídeo Cadastrado:
                          </span>
                          <span className="text-[#D4AF37] font-mono text-[11px] break-all block">
                            {selectedUser.video_url}
                          </span>
                          <span className="text-[11px] text-gray-400 block">
                            Status no Feed do Aluno:{' '}
                            <strong
                              className={
                                selectedUser.video_enabled ? 'text-[#22C55E]' : 'text-amber-400'
                              }
                            >
                              {selectedUser.video_enabled
                                ? 'Visível para os alunos'
                                : 'Oculto (aguardando liberação do admin)'}
                            </strong>
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={updatingVideo}
                          onClick={() => handleToggleVideoApproval(selectedUser)}
                          className={`text-xs font-bold uppercase shrink-0 px-4 py-2 flex items-center gap-1.5 transition-all shadow-md ${
                            selectedUser.video_enabled
                              ? 'border border-amber-500/50 text-amber-300 bg-amber-950/40 hover:bg-amber-900/60'
                              : 'bg-[#22C55E] text-black hover:bg-[#1eb354]'
                          }`}
                        >
                          {updatingVideo ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : selectedUser.video_enabled ? (
                            <>
                              <Ban className="w-4 h-4" />
                              Suspender Vídeo
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Aprovar & Liberar Vídeo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center space-y-1">
                      <Video className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-300 font-montserrat">
                        Nenhum link de vídeo cadastrado por este profissional
                      </p>
                      <p className="text-[11px] text-gray-500">
                        O profissional pode adicionar seu pitch em seu próprio painel de perfil.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Informações Complementares */}
              <div className="space-y-3">
                {selectedUser.bio && (
                  <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A]">
                    <h5 className="text-[10px] font-bold uppercase text-[#D4AF37] font-montserrat mb-1">
                      Biografia / Apresentação
                    </h5>
                    <p className="text-xs text-gray-300 leading-relaxed font-inter">
                      {selectedUser.bio}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-montserrat">
                      Localização
                    </span>
                    <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                      {selectedUser.city || 'São Paulo'} - {selectedUser.state || 'SP'}
                    </span>
                  </div>
                  {selectedUser.phone && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-montserrat">
                        Telefone
                      </span>
                      <span className="text-white font-semibold flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-[#22C55E]" />
                        {selectedUser.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações do Admin */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#2A2A2A]">
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  className="w-full sm:w-auto border-[#2A2A2A] text-gray-300 text-xs"
                >
                  Fechar
                </Button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => handleToggleApproval(selectedUser)}
                    className={`w-full sm:w-auto text-xs font-bold uppercase ${
                      selectedUser.approved
                        ? 'bg-red-900/40 border border-red-500/40 text-red-300 hover:bg-red-900/60'
                        : 'bg-[#22C55E] text-black hover:bg-[#1eb354]'
                    }`}
                  >
                    {selectedUser.approved ? 'Bloquear Usuário' : 'Aprovar Usuário'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
