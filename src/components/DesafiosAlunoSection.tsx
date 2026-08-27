import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { ChallengeRecord, ChallengeParticipantRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Flame,
  CheckCircle2,
  Calendar,
  Sparkles,
  Award,
  Users,
  Clock,
  Loader2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

export function DesafiosAlunoSection() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [participations, setParticipations] = useState<Record<string, ChallengeParticipantRecord>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadChallengesAndParticipations = async () => {
    if (!user) return
    try {
      // 1. Carregar desafios
      const resChallenges = await pb.collection('challenges').getList<ChallengeRecord>(1, 50, {
        sort: '-created',
        expand: 'professional_id',
      })
      setChallenges(resChallenges.items)

      // 2. Carregar participações do aluno
      const resParts = await pb
        .collection('challenge_participants')
        .getList<ChallengeParticipantRecord>(1, 100, {
          filter: `aluno_id = "${user.id}"`,
        })

      const partMap: Record<string, ChallengeParticipantRecord> = {}
      resParts.items.forEach((p) => {
        partMap[p.challenge_id] = p
      })
      setParticipations(partMap)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChallengesAndParticipations()
  }, [user])

  // Entrar em um desafio
  const handleJoinChallenge = async (challengeId: string) => {
    if (!user) return
    setActionLoading(challengeId)
    try {
      const newPart = await pb
        .collection('challenge_participants')
        .create<ChallengeParticipantRecord>({
          challenge_id: challengeId,
          aluno_id: user.id,
          dias_concluidos: [],
          completed: false,
        })

      setParticipations((prev) => ({ ...prev, [challengeId]: newPart }))
      toast.success('Inscrição no desafio realizada com sucesso! Bom treino!')
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao entrar no desafio.')
    } finally {
      setActionLoading(null)
    }
  }

  // Marcar dia de desafio concluído
  // Regra do Recurso 7: Cada dia de desafio concluído equivale a 1 aula para pontuação (registra em services)
  const handleCompleteDay = async (challenge: ChallengeRecord) => {
    if (!user) return
    const part = participations[challenge.id]
    if (!part) return

    const todayStr = new Date().toISOString().split('T')[0]
    const currentDays: string[] = Array.isArray(part.dias_concluidos)
      ? [...part.dias_concluidos]
      : []

    if (currentDays.includes(todayStr)) {
      toast.info(
        'Você já registrou a conclusão do desafio de hoje! Volte amanhã para pontuar novamente.',
      )
      return
    }

    setActionLoading(challenge.id)
    try {
      currentDays.push(todayStr)
      const isFinished = currentDays.length >= challenge.dias_total

      // Atualizar participação
      const updatedPart = await pb
        .collection('challenge_participants')
        .update<ChallengeParticipantRecord>(part.id, {
          dias_concluidos: currentDays,
          completed: isFinished,
        })

      // Criar registro na collection services com type: desafio
      await pb.collection('services').create({
        student: user.id,
        professional: challenge.professional_id || null,
        type: 'desafio',
        title: `Dia ${currentDays.length}/${challenge.dias_total} - ${challenge.title}`,
        value: 0,
        status: 'concluido',
        completed_at: new Date().toISOString(),
        notes: `Dia de desafio concluído (${currentDays.length}/${challenge.dias_total}). Computado como 1 aula para pontuação e ranking de cashback.`,
      })

      setParticipations((prev) => ({ ...prev, [challenge.id]: updatedPart }))

      if (isFinished) {
        toast.success(
          `🎉 PARABÉNS! Você concluiu os ${challenge.dias_total} dias do "${challenge.title}" e conquistou a insígnia ${challenge.reward_badge || 'Campeão'}!`,
        )
      } else {
        toast.success(
          `Dia ${currentDays.length}/${challenge.dias_total} concluído! +1 Serviço contabilizado para o Ranking!`,
        )
      }
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao registrar progresso no desafio.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-xs font-bold text-[#FF7A00] uppercase font-montserrat mb-1">
            <Flame className="w-3.5 h-3.5" />
            Desafios & Gamificação 369
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase">
            Desafios de Alta Performance
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Participe dos desafios lançados pelos mestres. Cada dia concluído conta como +1 aula
            para sua pontuação no ranking e cashback!
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
          <span className="text-xs uppercase font-montserrat">Carregando desafios...</span>
        </div>
      ) : challenges.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-white font-montserrat">
            Nenhum desafio ativo no momento
          </p>
          <p className="text-xs text-gray-500">
            Novos desafios são criados pelos profissionais semanalmente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {challenges.map((challenge) => {
            const part = participations[challenge.id]
            const isParticipating = !!part
            const completedDaysCount = part?.dias_concluidos?.length || 0
            const progressPct = Math.min(
              100,
              Math.round((completedDaysCount / challenge.dias_total) * 100),
            )
            const isCompleted = part?.completed || completedDaysCount >= challenge.dias_total
            const todayStr = new Date().toISOString().split('T')[0]
            const completedToday = part?.dias_concluidos?.includes(todayStr)

            return (
              <div
                key={challenge.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  isCompleted
                    ? 'bg-[#141414] border-[#22C55E]/40'
                    : isParticipating
                      ? 'bg-[#141414] border-[#FF7A00]/50 shadow-[0_0_20px_rgba(255,122,0,0.1)]'
                      : 'bg-[#141414] border-[#2A2A2A] hover:border-gray-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold font-montserrat uppercase px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-[#FF7A00] flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      {challenge.dias_total} Dias
                    </span>

                    {isCompleted ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Desafio Concluído
                      </span>
                    ) : isParticipating ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-[#0057FF] flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Em Andamento
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-gray-800 text-gray-300">
                        Disponível
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold font-montserrat text-white">
                      {challenge.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-inter mt-1 leading-relaxed">
                      {challenge.description || 'Complete a meta diária e evolua com o time 369.'}
                    </p>
                  </div>

                  {challenge.regras && (
                    <div className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-xs text-gray-300 font-inter">
                      <strong className="text-white block mb-0.5">Regras do Desafio:</strong>
                      {challenge.regras}
                    </div>
                  )}

                  {/* Tracking de Progresso (se participando) */}
                  {isParticipating && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-montserrat uppercase">Progresso:</span>
                        <span className="font-bold text-[#FF7A00] font-mono">
                          {completedDaysCount}/{challenge.dias_total} dias ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-[#0E0E0E] rounded-full overflow-hidden border border-[#2A2A2A] p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#D4AF37] transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="pt-3 border-t border-[#222222]">
                  {isCompleted ? (
                    <div className="p-2.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <Award className="w-4 h-4" /> Insígnia Desbloqueada:{' '}
                      {challenge.reward_badge || 'Campeão 369'}
                    </div>
                  ) : isParticipating ? (
                    <Button
                      onClick={() => handleCompleteDay(challenge)}
                      disabled={actionLoading === challenge.id || completedToday}
                      className={`w-full font-bold text-xs uppercase rounded-xl transition-all ${
                        completedToday
                          ? 'bg-gray-800 text-gray-400 border border-gray-700 cursor-not-allowed'
                          : 'bg-[#FF7A00] text-black hover:bg-[#ff8c1f] shadow-md'
                      }`}
                    >
                      {actionLoading === challenge.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : completedToday ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Dia de Hoje Concluído ✓
                        </>
                      ) : (
                        <>
                          <Flame className="w-3.5 h-3.5 mr-1" /> Concluir Dia de Hoje (+1 Aula)
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleJoinChallenge(challenge.id)}
                      disabled={actionLoading === challenge.id}
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl"
                    >
                      {actionLoading === challenge.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Aceitar Desafio & Participar'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
