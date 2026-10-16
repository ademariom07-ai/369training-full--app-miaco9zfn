import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordModel } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'

export interface ChatMessage extends RecordModel {
  sender: string
  receiver: string
  content: string
  read: boolean
  created: string
}

// Intervalo da checagem de reserva: entrega as mensagens mesmo se a conexão em
// tempo real cair (ex.: proxy da hospedagem que encerra conexões abertas).
const POLL_MS = 6000

const byCreated = (a: ChatMessage, b: ChatMessage) => a.created.localeCompare(b.created)

/**
 * Conversa entre o usuário logado e outra pessoa.
 * - Carrega o histórico ao trocar de conversa;
 * - Recebe novas mensagens em tempo real com UMA assinatura estável (useRealtime),
 *   em vez de reassinar a cada troca de conversa (o que perdia mensagens);
 * - Checa novas mensagens a cada poucos segundos como reserva;
 * - `addMessage` mostra na hora a mensagem que o próprio usuário enviou.
 */
export function useChatMessages(userId?: string, partnerId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const pairRef = useRef({ userId, partnerId })
  pairRef.current = { userId, partnerId }

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      let changed = false
      for (const m of incoming) {
        const old = byId.get(m.id)
        if (!old || old.updated !== m.updated) {
          byId.set(m.id, m)
          changed = true
        }
      }
      return changed ? [...byId.values()].sort(byCreated) : prev
    })
  }, [])

  const belongsToPair = (m: ChatMessage) => {
    const { userId: u, partnerId: p } = pairRef.current
    return (
      !!u && !!p && ((m.sender === u && m.receiver === p) || (m.sender === p && m.receiver === u))
    )
  }

  const fetchMessages = useCallback(async () => {
    if (!userId || !partnerId) return []
    const res = await pb.collection('messages').getList<ChatMessage>(1, 200, {
      filter: pb.filter(
        '(sender = {:u} && receiver = {:p}) || (sender = {:p} && receiver = {:u})',
        { u: userId, p: partnerId },
      ),
      sort: '-created',
    })
    return res.items.reverse()
  }, [userId, partnerId])

  // Histórico ao abrir/trocar de conversa
  useEffect(() => {
    setMessages([])
    if (!userId || !partnerId) return
    let active = true
    fetchMessages()
      .then((items) => {
        if (active) setMessages(items)
      })
      .catch(() => {
        if (active) setMessages([])
      })
    return () => {
      active = false
    }
  }, [userId, partnerId, fetchMessages])

  // Tempo real
  useRealtime<ChatMessage>(
    'messages',
    (e) => {
      if ((e.action === 'create' || e.action === 'update') && belongsToPair(e.record)) {
        merge([e.record])
      }
    },
    !!userId,
  )

  // Reserva: checagem periódica enquanto a aba está visível
  useEffect(() => {
    if (!userId || !partnerId) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      fetchMessages()
        .then(merge)
        .catch(() => {})
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [userId, partnerId, fetchMessages, merge])

  const addMessage = useCallback((m: ChatMessage) => merge([m]), [merge])

  return { messages, setMessages, addMessage }
}

export default useChatMessages
