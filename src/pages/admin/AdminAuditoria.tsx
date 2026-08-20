import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert, Search, Download, Calendar, Lock, UserCheck } from 'lucide-react'
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
  const [audits, setAudits] = useState<AuditItem[]>([
    {
      id: 'aud_1',
      actor: 'Ademario Master Admin',
      action: 'PLATFORM_INITIALIZED',
      target_type: 'platform_config',
      target_id: 'seed_init',
      details: { version: '2.4.0', status: 'ready' },
      created: new Date().toISOString(),
    },
    {
      id: 'aud_2',
      actor: 'Ademario Master Admin',
      action: 'PROFESSIONAL_APPROVED',
      target_type: 'users',
      target_id: 'carlos_coach',
      details: { cref: 'CREF 098765-G/SP', name: 'Prof. Carlos Silva' },
      created: new Date(Date.now() - 3600000).toISOString(),
    },
  ])

  const [search, setSearch] = useState('')

  useEffect(() => {
    pb.collection('audits')
      .getList<AuditItem>(1, 50, { sort: '-created' })
      .then((res) => {
        if (res.items.length > 0) {
          setAudits(res.items)
        }
      })
      .catch(() => {})
  }, [])

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'ID,Data,Ator,Acao,Tipo_Alvo,ID_Alvo\n' +
      audits
        .map(
          (a) =>
            `"${a.id}","${a.created}","${a.actor || 'Sistema'}","${a.action}","${a.target_type}","${a.target_id || ''}"`,
        )
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
      a.actor?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Trilha Imutável LGPD & Segurança
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Auditoria de Operações
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Registro detalhado de aprovações, bloqueios, alterações de parâmetros financeiros e
            acessos sensíveis.
          </p>
        </div>

        <Button
          onClick={handleExportCSV}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg"
        >
          <Download className="w-4 h-4" /> Exportar Relatório CSV
        </Button>
      </div>

      {/* FILTER SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por ação, ator ou alvo..."
          className="pl-10 bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
        />
      </div>

      {/* AUDIT LOG TABLE */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-inter">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Ação</th>
                <th className="pb-3">Ator</th>
                <th className="pb-3">Alvo</th>
                <th className="pb-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#141414] transition-colors">
                  <td className="py-3 font-mono text-gray-400">
                    {new Date(item.created).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3">
                    <span className="font-bold text-[#D4AF37] font-mono">{item.action}</span>
                  </td>
                  <td className="py-3 font-semibold text-white">
                    {item.actor || 'Sistema / Cron'}
                  </td>
                  <td className="py-3 text-gray-300">
                    <span className="font-mono text-xs">{item.target_type}</span>{' '}
                    {item.target_id && (
                      <span className="text-gray-500 text-[10px]">({item.target_id})</span>
                    )}
                  </td>
                  <td className="py-3 text-right font-mono text-[11px] text-gray-400">
                    {item.details ? JSON.stringify(item.details).substring(0, 50) + '...' : '—'}
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
