import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, RefreshCw, Loader2, TrendingUp } from 'lucide-react'
import {
  crmApi,
  CRM_CATEGORY_LABELS,
  CRM_STATUS_LABELS,
  type CrmAdminOverview,
  type CrmCategory,
} from '@/services/crm'

const CATEGORY_ORDER: CrmCategory[] = [
  'personal_trainer',
  'nutricionista',
  'fisioterapeuta',
  'psicologo',
  'professor_artes_marciais',
]

export const AdminCrmPanel: React.FC = () => {
  const [overview, setOverview] = useState<CrmAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await crmApi.adminOverview()
      setOverview(data)
    } catch (_) {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card className="p-5 rounded-2xl bg-[#101010] border border-[#2A2A2A]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold font-montserrat uppercase text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#D4AF37]" /> CRM — Alunos & Parceiros por Categoria
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
          className="border-[#2A2A2A] text-gray-300 h-8"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {loading && !overview ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando painel CRM...
        </div>
      ) : !overview ? (
        <p className="text-sm text-gray-500">Sem dados do CRM.</p>
      ) : (
        <div className="space-y-5">
          {/* Totais gerais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AdminKpi label="Contatos CRM" value={overview.totals.contacts} />
            <AdminKpi label="Convertidos no mês" value={overview.totals.won_this_month} />
            <AdminKpi label="Parceiros" value={overview.totals.professionals} />
            <AdminKpi label="Alunos vinculados" value={overview.totals.linked_students} />
          </div>

          {/* Por categoria */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 border-b border-[#2A2A2A]">
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3 text-center">Contatos</th>
                  <th className="py-2 pr-3 text-center">Profs.</th>
                  <th className="py-2 pr-3 text-center">Novo</th>
                  <th className="py-2 pr-3 text-center">Em contato</th>
                  <th className="py-2 pr-3 text-center">Ativo</th>
                  <th className="py-2 pr-3 text-center">Inativo</th>
                  <th className="py-2 pr-3 text-center">Follow-ups venc.</th>
                  <th className="py-2 text-center">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((cat) => {
                  const row = overview.by_category.find((c) => c.category === cat)
                  return (
                    <tr key={cat} className="text-xs border-b border-[#181818]">
                      <td className="py-2 pr-3 font-bold text-white">{CRM_CATEGORY_LABELS[cat]}</td>
                      <td className="py-2 pr-3 text-center text-gray-300">
                        {row?.total_contacts ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-gray-300">
                        {overview.professionals_by_category[cat] ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-[#0057FF]">
                        {row?.counts?.novo ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-[#FF7A00]">
                        {row?.counts?.em_contato ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-[#22C55E]">
                        {row?.counts?.ativo ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-gray-500">
                        {row?.counts?.inativo ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-center text-red-400">
                        {row?.overdue_followups ?? 0}
                      </td>
                      <td className="py-2 text-center text-[#D4AF37] font-bold">
                        {row?.conversion_rate ?? 0}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Ciclo de vida */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A]">
              <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">
                Ciclo de vida — Parceiros
              </p>
              <p className="text-xs text-gray-300">
                Ativos:{' '}
                <span className="text-[#22C55E] font-bold">
                  {overview.professionals_lifecycle.ativo}
                </span>{' '}
                · Novos:{' '}
                <span className="text-[#0057FF] font-bold">
                  {overview.professionals_lifecycle.novo}
                </span>{' '}
                · Inativos:{' '}
                <span className="text-gray-500 font-bold">
                  {overview.professionals_lifecycle.inativo}
                </span>
              </p>
            </Card>
            <Card className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A]">
              <p className="text-[10px] uppercase text-gray-400 font-bold mb-2">
                Ciclo de vida — Alunos
              </p>
              <p className="text-xs text-gray-300">
                Ativos:{' '}
                <span className="text-[#22C55E] font-bold">
                  {overview.students_lifecycle.ativo}
                </span>{' '}
                · Inadimplentes:{' '}
                <span className="text-red-400 font-bold">
                  {overview.students_lifecycle.inadimplente}
                </span>{' '}
                · Cancelados:{' '}
                <span className="text-gray-500 font-bold">
                  {overview.students_lifecycle.cancelado}
                </span>{' '}
                · Sem vínculo:{' '}
                <span className="text-[#FF7A00] font-bold">
                  {overview.students_lifecycle.sem_vinculo}
                </span>
              </p>
            </Card>
          </div>

          <p className="text-[10px] text-gray-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Métricas do mês {overview.month} (base de contatos
            CRM).
          </p>
        </div>
      )}
    </Card>
  )
}

const AdminKpi: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Card className="p-3 rounded-xl bg-[#181818] border border-[#2A2A2A]">
    <p className="text-[10px] text-gray-400 uppercase font-montserrat">{label}</p>
    <p className="text-xl font-extrabold font-montserrat text-white">{value}</p>
  </Card>
)
