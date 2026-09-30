import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert, Search, Download, Inbox, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface AuditItem {
  id: string
  actor: string
  action: string
  target_type: string
  target_id: string
  details?: Record<string, unknown>
  created: string
}

export default function AdminAuditoria() {
  // Inicialização 100% limpa (sem registros fake aud_1 / aud_2)
  const [audits, setAudits] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadAudits = () => {
    setLoading(true)
    pb.collection('audits')
      .getList<AuditItem>(1, 100, { sort: '-created' })
      .then((res) => {
        setAudits(res.items || [])
      })
      .catch((err) => {
        console.warn('Erro ao carregar auditorias:', err)
        setAudits([])
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadAudits()
  }, [])

  const handleExportCSV = () => {
    if (audits.length === 0) {
      toast.info('Nenhum evento de auditoria registrado para exportar.')
      return
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      'ID,Data,Ator,Acao,Tipo_Alvo,ID_Alvo,Detalhes\n' +
      audits
        .map((a) => {
          const detailStr = a.details ? JSON.stringify(a.details).replace(/"/g, '""') : ''
          return `"${a.id}","${a.created}","${a.actor || 'Sistema'}","${a.action}","${a.target_type}","${a.target_id || ''}","${detailStr}"`
        })
        .join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `auditoria_369training_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Relatório de auditoria exportado com sucesso em CSV.')
  }

  const filtered = audits.filter(
    (a) =>
      a.action?.toLowerCase().includes(search.toLowerCase()) ||
      a.target_type?.toLowerCase().includes(search.toLowerCase()) ||
      a.actor?.toLowerCase().includes(search.toLowerCase()) ||
      a.target_id?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-8 pb-12 font-inter text-[#1A1A1A]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Trilha Imutável LGPD & Segurança
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-[#1A1A1A] uppercase">
            Auditoria de Operações
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 font-inter mt-1">
            Registro auditável de aprovações, bloqueios, alterações de parâmetros financeiros e
            acessos sensíveis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadAudits}
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
            <Download className="w-4 h-4" /> Exportar Relatório CSV
          </Button>
        </div>
      </div>

      {/* FILTER SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por ação, ator ou alvo..."
          className="pl-10 bg-white border-[#E4E2DC] rounded-xl text-xs text-[#1A1A1A] shadow-sm focus:border-[#0057FF]"
        />
      </div>

      {/* AUDIT LOG TABLE */}
      <Card className="bg-white border border-[#E4E2DC] p-6 rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#E4E2DC] text-gray-500 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Ação</th>
                <th className="pb-3">Ator</th>
                <th className="pb-3">Alvo</th>
                <th className="pb-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                    Carregando registros de auditoria...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-gray-300" />
                      <p className="font-montserrat font-bold text-sm text-[#1A1A1A]">
                        Nenhum evento de auditoria registrado ainda.
                      </p>
                      <p className="text-xs text-gray-400 max-w-sm">
                        As operações de aprovação, alterações de cadastro e fechamentos mensais
                        gravam registros imutáveis nesta trilha.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7F5F0] transition-colors">
                    <td className="py-3 font-mono text-gray-600">
                      {new Date(item.created).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3">
                      <span className="font-bold text-[#9A7B1C] font-mono">{item.action}</span>
                    </td>
                    <td className="py-3 font-semibold text-[#1A1A1A]">
                      {item.actor || 'Sistema / Cron'}
                    </td>
                    <td className="py-3 text-gray-700">
                      <span className="font-mono text-xs">{item.target_type}</span>{' '}
                      {item.target_id && (
                        <span className="text-gray-500 text-[10px]">({item.target_id})</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-[11px] text-gray-500">
                      {item.details ? JSON.stringify(item.details).substring(0, 50) + '...' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
