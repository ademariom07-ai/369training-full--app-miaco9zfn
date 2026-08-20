import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserProfile } from '@/contexts/AuthContext'

export default function AprovacoesProfissionais() {
  const [pendingList, setPendingList] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  const loadPending = async () => {
    try {
      const res = await pb.collection('users').getList<UserProfile>(1, 50, {
        filter: 'role = "profissional" && approved = false',
        sort: '-created',
      })
      setPendingList(res.items)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadPending().finally(() => setLoading(false))
  }, [])

  const handleApprove = async (prof: UserProfile) => {
    try {
      await pb.collection('users').update(prof.id, { approved: true })

      // Append audit
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: prof.id,
        action: 'PROFESSIONAL_APPROVED',
        details: { cref: prof.cref, name: prof.name, email: prof.email },
      })

      // Send notification to professional
      await pb.collection('notifications').create({
        user: prof.id,
        type: 'account_approved',
        title: 'Perfil Aprovado com Sucesso!',
        body: 'Parabéns! Suas credenciais foram validadas. Seu perfil agora está disponível para alunos no 369TRAINING.',
        read: false,
        action_url: '/profissional/dashboard',
      })

      toast.success(`Profissional ${prof.name} aprovado com sucesso!`)
      loadPending()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao aprovar.')
    }
  }

  const handleReject = async (prof: UserProfile) => {
    try {
      await pb.collection('audits').create({
        actor: pb.authStore.record?.id,
        target_type: 'users',
        target_id: prof.id,
        action: 'PROFESSIONAL_REJECTED',
        details: { cref: prof.cref, name: prof.name, reason: 'Documento divergente' },
      })

      toast.info(`Cadastro de ${prof.name} reprovado e registrado em auditoria.`)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao reprovar.')
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 uppercase font-montserrat mb-2">
          <FileCheck2 className="w-3.5 h-3.5" />
          Fila de Validação Regulatória
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Aprovações de Profissionais
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Audite registros de classe (CREF / CRN / CREFITO), selfies e documentos de identidade
          antes da liberação pública de serviços.
        </p>
      </div>

      {pendingList.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto mb-3" />
          <h3 className="text-lg font-bold font-montserrat text-white">
            Nenhum Profissional Pendente
          </h3>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Todas as solicitações de cadastro profissional foram auditadas e aprovadas.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingList.map((prof) => (
            <Card
              key={prof.id}
              className="bg-[#181818] border border-amber-500/30 p-6 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
            >
              <div className="flex items-start gap-4">
                <img
                  src="https://img.usecurling.com/ppl/medium?gender=male&seed=3"
                  alt={prof.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold font-montserrat text-white text-base">{prof.name}</h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/40">
                      Pendente de Análise
                    </span>
                  </div>

                  <p className="text-xs text-[#0057FF] font-semibold mt-0.5">
                    {prof.specialties?.join(' • ') || 'Educação Física'}
                  </p>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-inter mt-2">
                    <span className="font-mono text-white">
                      Registro:{' '}
                      <strong className="text-[#D4AF37]">{prof.cref || 'Em validação'}</strong>
                    </span>
                    <span>•</span>
                    <span>Tipo: {prof.professional_type || 'Pessoa Física'}</span>
                    <span>•</span>
                    <span>
                      {prof.city} - {prof.state}
                    </span>
                  </div>

                  {prof.bio && (
                    <p className="text-xs text-gray-300 font-inter mt-2 max-w-xl italic">
                      &ldquo;{prof.bio}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <Button
                  onClick={() => handleApprove(prof)}
                  className="flex-1 lg:flex-initial bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprovar Cadastro
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReject(prof)}
                  className="flex-1 lg:flex-initial border-red-900 text-red-400 hover:bg-red-950/30 text-xs uppercase px-4 py-2.5 rounded-xl"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reprovar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
