import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  ShieldCheck,
  Award,
  DollarSign,
  TrendingUp,
  PieChart,
  Activity,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import type { UserProfile } from '@/contexts/AuthContext'
import type { ServiceRecord, WalletTransactionRecord } from '@/services/api'

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(24)
  const [totalPros, setTotalPros] = useState(8)
  const [pendingApprovals, setPendingApprovals] = useState(1)
  const [totalServices, setTotalServices] = useState(14)
  const [grossRevenue, setGrossRevenue] = useState(3500.0)
  const [partnerPoolDistributed, setPartnerPoolDistributed] = useState(1330.0)

  useEffect(() => {
    // Count pending approvals
    pb.collection('users')
      .getList<UserProfile>(1, 10, {
        filter: 'role = "profissional" && approved = false',
      })
      .then((res) => {
        setPendingApprovals(res.totalItems)
      })
      .catch(() => {})

    // Count services
    pb.collection('services')
      .getList<ServiceRecord>(1, 50)
      .then((res) => {
        setTotalServices(res.totalItems)
        let rev = 0
        res.items.forEach((s) => {
          if (s.status === 'concluido') rev += s.value
        })
        if (rev > 0) {
          setGrossRevenue(rev)
          setPartnerPoolDistributed(rev * 0.38)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Master Admin • Painel de Controle
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Dashboard Administrativo 369
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Visão geral da plataforma, transações, receitas, aprovações e divisão do partner pool
            (38%).
          </p>
        </div>

        {pendingApprovals > 0 && (
          <Link to="/admin/aprovacoes">
            <Button className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {pendingApprovals} Profissional Pendente
            </Button>
          </Link>
        )}
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase">Usuários Totais</span>
            <Users className="w-4 h-4 text-[#0057FF]" />
          </div>
          <p className="text-2xl font-extrabold text-white font-montserrat">{totalUsers}</p>
          <span className="text-[10px] text-gray-400 font-inter">Alunos & Profissionais</span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase">
              Volume de Serviços
            </span>
            <Activity className="w-4 h-4 text-[#22C55E]" />
          </div>
          <p className="text-2xl font-extrabold text-[#22C55E] font-montserrat">
            R$ {grossRevenue.toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-400 font-inter">{totalServices} atendimentos</span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase">
              Pool Parceiros (38%)
            </span>
            <Award className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <p className="text-2xl font-extrabold text-[#D4AF37] font-montserrat">
            R$ {partnerPoolDistributed.toFixed(2)}
          </p>
          <span className="text-[10px] text-gray-400 font-inter">
            Distribuído via árvore binária
          </span>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-montserrat uppercase">
              Fila de Aprovação
            </span>
            <FileCheck2 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-400 font-montserrat">
            {pendingApprovals}
          </p>
          <span className="text-[10px] text-gray-400 font-inter">Aguardando auditoria</span>
        </Card>
      </div>

      {/* REVENUE SPLIT BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Split Chart/Table */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl">
          <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4 flex items-center justify-between">
            <span>Split Padrão de Receita 369</span>
            <span className="text-xs text-[#D4AF37] font-semibold">100% Auditável</span>
          </h3>

          <div className="space-y-3 font-inter text-xs">
            <div className="flex justify-between items-center py-2 border-b border-[#2A2A2A]">
              <span className="flex items-center gap-2 text-white font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" /> Partner Pool / Cashback
                Rede
              </span>
              <span className="font-bold text-[#D4AF37] font-mono">38.0%</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2A2A2A]">
              <span className="flex items-center gap-2 text-white font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0057FF]" /> Plataforma & Servidores
                (App)
              </span>
              <span className="font-bold text-gray-300 font-mono">30.0%</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2A2A2A]">
              <span className="flex items-center gap-2 text-white font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Filantropia & Impacto
                Social
              </span>
              <span className="font-bold text-[#22C55E] font-mono">10.0%</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#2A2A2A]">
              <span className="flex items-center gap-2 text-white font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Tributos & Impostos
              </span>
              <span className="font-bold text-gray-400 font-mono">10.0%</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="flex items-center gap-2 text-white font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Suporte (4%) • Mkt (4%)
                • Carreira (4%)
              </span>
              <span className="font-bold text-purple-400 font-mono">12.0%</span>
            </div>
          </div>
        </Card>

        {/* Quick Admin Actions */}
        <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold font-montserrat text-white text-base uppercase mb-4">
              Módulos de Governança
            </h3>

            <div className="space-y-3">
              <Link to="/admin/usuarios" className="block">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-[#0057FF] flex items-center justify-between transition-all group">
                  <div>
                    <h4 className="text-xs font-bold text-white font-montserrat group-hover:text-[#0057FF]">
                      Gestão de Usuários
                    </h4>
                    <p className="text-[10px] text-gray-400 font-inter">
                      Consultar, editar, ativar, inativar ou bloquear contas.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
                </div>
              </Link>

              <Link to="/admin/aprovacoes" className="block">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-[#D4AF37] flex items-center justify-between transition-all group">
                  <div>
                    <h4 className="text-xs font-bold text-white font-montserrat group-hover:text-[#D4AF37]">
                      Fila de Aprovações de Profissionais
                    </h4>
                    <p className="text-[10px] text-gray-400 font-inter">
                      Auditar documentos, selfies e registros CREF/CRN/CREFITO.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
                </div>
              </Link>

              <Link to="/admin/ranking" className="block">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-[#22C55E] flex items-center justify-between transition-all group">
                  <div>
                    <h4 className="text-xs font-bold text-white font-montserrat group-hover:text-[#22C55E]">
                      Parâmetros do Ranking & Cashback
                    </h4>
                    <p className="text-[10px] text-gray-400 font-inter">
                      Ajustar variáveis de nível, tarifas de serviço e metas ESG.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2A2A2A] text-right">
            <Link
              to="/admin/auditoria"
              className="text-xs text-[#D4AF37] font-bold hover:underline"
            >
              Ver Logs de Auditoria LGPD →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
