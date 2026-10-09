import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type { MessageRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Inbox,
  Flag,
  CheckCircle,
  Eye,
  MessageSquare,
  Lock,
  Download,
  Calendar,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

interface MessageModerationItem extends MessageRecord {
  expand?: {
    sender?: { id: string; name: string; email: string; role: string }
    receiver?: { id: string; name: string; email: string; role: string }
  }
}

export default function AdminChatModeracao() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageModerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeMessage, setActiveMessage] = useState<MessageModerationItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const loadReportedMessages = async () => {
    setLoading(true)
    try {
      // Regra de privacidade LGPD:
      // O admin só visualiza mensagens denunciadas (reported = true).
      // Mensagens privadas sem reporte permanecem inacessíveis para preservar o sigilo das conversas.
      const res = await pb.collection('messages').getList<MessageModerationItem>(1, 100, {
        filter: 'reported = true',
        sort: '-created',
        expand: 'sender,receiver',
      })
      setMessages(res.items || [])
    } catch (err) {
      console.warn('Erro ao carregar mensagens reportadas:', err)
      toast.error('Não foi possível carregar as mensagens denunciadas.')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportedMessages()
  }, [])

  const handleOpenDetail = (msg: MessageModerationItem) => {
    setActiveMessage(msg)
    setModalOpen(true)
  }

  const handleMarkAsReviewed = async (msg: MessageModerationItem) => {
    setActingId(msg.id)
    try {
      // Registra evento de auditoria antes da desmarcação
      try {
        await pb.collection('audits').create({
          actor: user?.name || user?.email || 'Administrador',
          action: 'chat_moderation_reviewed',
          target_type: 'message_report',
          target_id: msg.id,
          details: {
            message_id: msg.id,
            sender_id: msg.sender,
            receiver_id: msg.receiver,
            report_reason: msg.report_reason,
            action_taken: 'marked_as_reviewed',
            reviewed_at: new Date().toISOString(),
          },
        })
      } catch (auditErr) {
        console.warn('Aviso ao registrar auditoria de moderação:', auditErr)
      }

      // Desmarca a denúncia (reported = false) mantendo histórico na auditoria
      await pb.collection('messages').update(msg.id, {
        reported: false,
        report_reason: `[REVISADO POR MODERAÇÃO] ${msg.report_reason || ''}`,
      })

      toast.success('Mensagem revisada e arquivada da fila de denúncias ativas.')
      setModalOpen(false)
      setActiveMessage(null)
      loadReportedMessages()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao processar moderação.')
    } finally {
      setActingId(null)
    }
  }

  const handleExportCSV = () => {
    if (messages.length === 0) {
      toast.info('Nenhuma denúncia na fila para exportar.')
      return
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      'ID_Mensagem,Data_Envio,Remetente_ID,Remetente_Nome,Destinatario_ID,Destinatario_Nome,Motivo_Denuncia,Conteudo\n' +
      messages
        .map((m) => {
          const senderName = m.expand?.sender?.name || m.sender
          const receiverName = m.expand?.receiver?.name || m.receiver
          const reason = (m.report_reason || '').replace(/"/g, '""')
          const content = (m.content || '').replace(/"/g, '""')
          return `"${m.id}","${m.created}","${m.sender}","${senderName}","${m.receiver}","${receiverName}","${reason}","${content}"`
        })
        .join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `denuncias_chat_369wellness_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Exportação de denúncias concluída.')
  }

  const filtered = messages.filter((m) => {
    const q = search.toLowerCase()
    const sender = m.expand?.sender?.name?.toLowerCase() || ''
    const receiver = m.expand?.receiver?.name?.toLowerCase() || ''
    const content = m.content?.toLowerCase() || ''
    const reason = m.report_reason?.toLowerCase() || ''
    return (
      sender.includes(q) ||
      receiver.includes(q) ||
      content.includes(q) ||
      reason.includes(q) ||
      m.id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-8 pb-12 font-inter text-[#1A1A1A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Conformidade LGPD & Moderação
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-[#1A1A1A] uppercase">
            Moderação de Chat
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 font-inter mt-1 max-w-2xl">
            Inspeção de mensagens denunciadas por alunos e profissionais. Em conformidade com o
            princípio de necessidade da LGPD, apenas mensagens com reporte explícito ficam visíveis
            ao administrador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadReportedMessages}
            disabled={loading}
            variant="outline"
            className="border-[#E4E2DC] bg-white hover:bg-[#F7F5F0] text-[#1A1A1A] font-bold text-xs uppercase px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleExportCSV}
            className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Aviso LGPD */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed font-inter">
          <span className="font-bold font-montserrat uppercase">Garantia de Sigilo & LGPD:</span> As
          conversas privadas regulares entre aluno e profissional não são expostas a nenhum
          administrador. A visualização só é liberada mediante denúncia expressa realizada por um
          dos participantes, gerando trilha imutável no log de auditoria.
        </div>
      </div>

      {/* Filtro Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por participante, motivo ou conteúdo..."
          className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-xs text-[#1A1A1A] shadow-sm focus:border-[#0057FF]"
        />
      </div>

      {/* Tabela de Mensagens Reportadas */}
      <Card className="bg-white border border-[#E4E2DC] p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#E4E2DC] mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold font-montserrat text-[#1A1A1A] uppercase">
              Fila de Mensagens Denunciadas
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-gray-600 bg-[#F5F4F0] px-2.5 py-1 rounded-full">
            {filtered.length} pendente(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#E4E2DC] text-gray-500 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Data / Hora</th>
                <th className="pb-3">Remetente</th>
                <th className="pb-3">Destinatário</th>
                <th className="pb-3">Motivo da Denúncia</th>
                <th className="pb-3">Conteúdo</th>
                <th className="pb-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                    Carregando denúncias...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-gray-300" />
                      <p className="font-montserrat font-bold text-sm text-[#1A1A1A]">
                        Nenhuma mensagem denunciada no momento.
                      </p>
                      <p className="text-xs text-gray-400 max-w-sm">
                        O ambiente de comunicação entre alunos e profissionais está em plena
                        conformidade. Denúncias futuras aparecerão nesta fila.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const senderName = item.expand?.sender?.name || item.sender
                  const senderRole = item.expand?.sender?.role || 'usuário'
                  const receiverName = item.expand?.receiver?.name || item.receiver
                  const receiverRole = item.expand?.receiver?.role || 'usuário'

                  return (
                    <tr key={item.id} className="hover:bg-[#F7F5F0] transition-colors">
                      <td className="py-3 font-mono text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(item.created).toLocaleString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="py-3 font-semibold text-[#1A1A1A]">
                        <div>{senderName}</div>
                        <span className="text-[10px] text-gray-400 uppercase font-montserrat">
                          {senderRole}
                        </span>
                      </td>
                      <td className="py-3 text-gray-700">
                        <div>{receiverName}</div>
                        <span className="text-[10px] text-gray-400 uppercase font-montserrat">
                          {receiverRole}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-semibold">
                          <Flag className="w-3 h-3 text-red-600" />
                          {item.report_reason || 'Denúncia sem justificativa'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 max-w-xs truncate italic">
                        &ldquo;{item.content}&rdquo;
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetail(item)}
                          className="border-[#0057FF]/40 text-[#0057FF] hover:bg-[#0057FF]/10 text-xs font-bold font-montserrat uppercase px-2.5 py-1 rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Inspecionar
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Inspeção e Ação de Moderação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-white border border-[#E4E2DC] text-[#1A1A1A] max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-2">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold font-montserrat text-[#1A1A1A] uppercase">
              Inspeção de Denúncia de Chat
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 font-inter">
              Revise o teor da mensagem e a justificativa fornecida pelo denunciante.
            </DialogDescription>
          </DialogHeader>

          {activeMessage && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Contexto dos Participantes */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8F7F3] border border-[#E4E2DC]">
                <div>
                  <span className="text-[10px] uppercase font-montserrat font-bold text-gray-500">
                    Remetente
                  </span>
                  <p className="font-semibold text-[#1A1A1A]">
                    {activeMessage.expand?.sender?.name || activeMessage.sender}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {activeMessage.expand?.sender?.email || '—'} (
                    {activeMessage.expand?.sender?.role || 'usuário'})
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-montserrat font-bold text-gray-500">
                    Destinatário
                  </span>
                  <p className="font-semibold text-[#1A1A1A]">
                    {activeMessage.expand?.receiver?.name || activeMessage.receiver}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {activeMessage.expand?.receiver?.email || '—'} (
                    {activeMessage.expand?.receiver?.role || 'usuário'})
                  </p>
                </div>
              </div>

              {/* Justificativa */}
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[10px] uppercase font-montserrat font-bold text-red-700 flex items-center gap-1">
                  <Flag className="w-3 h-3 text-red-600" /> Motivo da Denúncia
                </span>
                <p className="text-red-900 font-medium mt-1 font-inter">
                  {activeMessage.report_reason || 'Nenhuma justificativa detalhada foi fornecida.'}
                </p>
              </div>

              {/* Conteúdo da Mensagem */}
              <div className="p-3.5 rounded-xl bg-[#141414] text-white space-y-1">
                <span className="text-[10px] uppercase font-montserrat font-bold text-[#D4AF37] flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-[#D4AF37]" /> Conteúdo Original da Mensagem
                </span>
                <p className="text-xs text-gray-200 font-inter whitespace-pre-wrap leading-relaxed">
                  {activeMessage.content}
                </p>
                <div className="text-[10px] text-gray-400 font-mono text-right pt-2 border-t border-gray-800">
                  Enviada em {new Date(activeMessage.created).toLocaleString('pt-BR')} (ID:{' '}
                  {activeMessage.id})
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E2DC]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="border-[#E4E2DC] text-gray-700 hover:text-[#1A1A1A] text-xs font-bold uppercase rounded-xl"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  disabled={actingId === activeMessage.id}
                  onClick={() => handleMarkAsReviewed(activeMessage)}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-xs uppercase rounded-xl px-4 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {actingId === activeMessage.id ? 'Gravando...' : 'Marcar como Revisada'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
