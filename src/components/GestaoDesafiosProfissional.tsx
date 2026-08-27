import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { ChallengeRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Flame, Plus, Trophy, Award, Users, Calendar, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function GestaoDesafiosProfissional() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [regras, setRegras] = useState('')
  const [diasTotal, setDiasTotal] = useState<number>(21)
  const [rewardBadge, setRewardBadge] = useState('Guerreiro 369')

  const loadChallenges = async () => {
    if (!user) return
    try {
      const res = await pb.collection('challenges').getList<ChallengeRecord>(1, 50, {
        filter: `professional_id = "${user.id}"`,
        sort: '-created',
      })
      setChallenges(res.items)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChallenges()
  }, [user])

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!title.trim()) {
      toast.error('Informe o título do desafio.')
      return
    }

    setCreating(true)
    try {
      await pb.collection('challenges').create({
        title: title.trim(),
        description: description.trim(),
        regras: regras.trim(),
        dias_total: Number(diasTotal) || 7,
        reward_badge: rewardBadge.trim(),
        professional_id: user.id,
      })

      toast.success('Desafio publicado com sucesso para seus alunos e para a comunidade!')
      setModalOpen(false)
      setTitle('')
      setDescription('')
      setRegras('')
      setDiasTotal(21)
      setRewardBadge('Guerreiro 369')
      loadChallenges()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao criar desafio.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-xs font-bold text-[#FF7A00] uppercase font-montserrat mb-1">
            <Flame className="w-3.5 h-3.5" />
            BackOffice de Gamificação & Desafios
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase">
            Criar & Gerenciar Desafios
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Lance desafios de 7, 14, 21 ou 30 dias para engajar seus alunos. Cada dia completado
            pelo aluno equivale a 1 aula para o ranking.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#FF7A00] text-black hover:bg-[#ff8c1f] font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(255,122,0,0.25)]"
        >
          <Plus className="w-4 h-4" /> Novo Desafio
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
          <span className="text-xs uppercase font-montserrat">Carregando seus desafios...</span>
        </div>
      ) : challenges.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#141414] border border-[#2A2A2A] space-y-2">
          <Trophy className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white font-montserrat uppercase">
            Nenhum desafio criado por você ainda
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Crie seu primeiro desafio de consistência para impulsionar a retenção e atividade dos
            seus alunos.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            variant="outline"
            className="border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00]/10 text-xs font-bold uppercase mt-2"
          >
            Criar Primeiro Desafio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-[#FF7A00]/50 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase font-mono px-2.5 py-0.5 rounded bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30">
                    {c.dias_total} Dias
                  </span>
                  <span className="text-[10px] text-gray-500 font-inter">
                    Criado em {new Date(c.created).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-montserrat">{c.title}</h3>
                <p className="text-xs text-gray-400 font-inter line-clamp-2 mt-1">
                  {c.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#222222] flex justify-between items-center text-xs text-gray-300">
                <span className="flex items-center gap-1 text-[#D4AF37] font-semibold">
                  <Award className="w-3.5 h-3.5" /> {c.reward_badge || 'Campeão 369'}
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#FF7A00]" /> Criar Novo Desafio
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400 font-inter">
              Configure as regras e o período de dias para a conclusão do desafio.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateChallenge} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Título do Desafio *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Desafio 21 Dias de Consistência & Abdômen"
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Duração Total (Dias) *
                </label>
                <select
                  value={diasTotal}
                  onChange={(e) => setDiasTotal(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                >
                  <option value={7}>7 Dias (1 Semana)</option>
                  <option value={14}>14 Dias (2 Semanas)</option>
                  <option value={21}>21 Dias (Hábito / Foco)</option>
                  <option value={30}>30 Dias (Mês Completo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Insígnia de Recompensa
                </label>
                <Input
                  value={rewardBadge}
                  onChange={(e) => setRewardBadge(e.target.value)}
                  placeholder="Ex: Guerreiro 369"
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Descrição do Desafio
              </label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique o propósito deste desafio..."
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Regras Obrigatórias para Validação Diária
              </label>
              <Textarea
                rows={2}
                value={regras}
                onChange={(e) => setRegras(e.target.value)}
                placeholder="Ex: Treinar pelo menos 45 min, beber 3L de água e postar o check-in."
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white resize-none"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#FF7A00] text-black hover:bg-[#ff8c1f] font-extrabold text-xs uppercase rounded-xl flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar Desafio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
