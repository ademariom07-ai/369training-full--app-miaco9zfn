import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pb } from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Calendar,
  Globe,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface UserConsentItem {
  id: string
  document_slug: string
  version: number
  accepted_at: string
  consent_type: string
  created: string
}

export default function LgpdConsentimentos() {
  const { user } = useAuth()
  const [selectedCountry, setSelectedCountry] = useState<string>(user?.country || 'Brasil')
  const [consents, setConsents] = useState<UserConsentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  // Configuração dinâmica de DPO via platform_config
  const [dpoEmail, setDpoEmail] = useState('dpo@369training.com')
  const [dpoName, setDpoName] = useState('DPO 369TRAINING')
  const [retentionMonths, setRetentionMonths] = useState(6)

  useEffect(() => {
    loadDpoConfig()
    if (user) {
      loadUserConsents()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadDpoConfig = async () => {
    try {
      const rec = await pb.collection('platform_config').getFirstListItem('key = "dpo_config"')
      if (rec && rec.value) {
        const val = rec.value as any
        if (val.email) setDpoEmail(val.email)
        if (val.name) setDpoName(val.name)
        if (val.retention_period_months) setRetentionMonths(val.retention_period_months)
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const loadUserConsents = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await pb.collection('legal_acceptances').getList<UserConsentItem>(1, 100, {
        filter: `user = "${user.id}"`,
        sort: '-accepted_at',
      })
      setConsents(res.items || [])
    } catch {
      setConsents([])
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeConsent = async (item: UserConsentItem) => {
    if (!user) return
    if (
      !confirm(
        'Tem certeza que deseja revogar o consentimento de dados sensíveis de saúde?\n\nA revogação acarretará o bloqueio imediato do seu acesso às áreas clínicas (Treino, Nutrição e Fisioterapia) até que você concorde novamente.',
      )
    ) {
      return
    }

    setRevokingId(item.id)
    try {
      // 1. Excluir o aceite
      await pb.collection('legal_acceptances').delete(item.id)

      // 2. Registrar auditoria da revogação
      try {
        await pb.collection('audits').create({
          actor: user.id,
          target_type: 'legal_acceptances',
          target_id: item.id,
          action: 'SENSITIVE_DATA_CONSENT_REVOKED',
          details: {
            document_slug: item.document_slug,
            version: item.version,
            revoked_at: new Date().toISOString(),
          },
        })
      } catch {
        /* intentionally ignored */
      }

      toast.success(
        'Consentimento revogado com sucesso. O acesso às áreas clínicas foi bloqueado preventivamente.',
      )
      loadUserConsents()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast.error(e.message || 'Erro ao revogar consentimento.')
    } finally {
      setRevokingId(null)
    }
  }

  // Determina a jurisdição com base no país
  const getJurisdictionInfo = (countryName: string) => {
    switch (countryName) {
      case 'Brasil':
        return {
          title: 'LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)',
          badge: 'Jurisdição Brasileira (LGPD)',
          legalBases: 'Art. 7º, V e Art. 11, I da LGPD (Lei nº 13.709/2018)',
          overview:
            'A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) estabelece regras claras para a coleta, armazenamento, tratamento e compartilhamento de dados pessoais no Brasil, garantindo ao cidadão titular maior controle, consentimento informado e transparência sobre suas informações.',
          rights:
            'Direito de confirmação de tratamento, acesso facilitado, correção de dados incompletos ou inexatos, anonimização, portabilidade a outro fornecedor, eliminação definitiva e revogação do consentimento (Art. 18 da LGPD).',
          dpoNote: `Encarregado pelo Tratamento de Dados Pessoais (DPO Brasil): ${dpoEmail}`,
        }
      case 'Portugal':
      case 'Reino Unido':
        return {
          title: 'GDPR / UK GDPR — General Data Protection Regulation (Regulamento UE 2016/679)',
          badge: 'Jurisdição Europeia / Reino Unido (GDPR)',
          legalBases:
            'Art. 6(1)(b) e Art. 9(2)(a) do Regulamento Geral sobre a Proteção de Dados (GDPR / UK GDPR)',
          overview:
            'O GDPR (General Data Protection Regulation — Regulamento UE 2016/679) e o UK Data Protection Act 2018 definem os mais rigorosos padrões globais de privacidade, proteção de direitos fundamentais e livre circulação de dados na União Europeia e no Reino Unido.',
          rights:
            'Right of access (Art. 15), right to rectification (Art. 16), right to erasure / right to be forgotten (Art. 17), right to restriction of processing (Art. 18), right to data portability (Art. 20) and right to object (Art. 21).',
          dpoNote: `Data Protection Officer (DPO / Lead Representative): ${dpoEmail}`,
        }
      case 'Estados Unidos':
        return {
          title: 'CCPA / CPRA — California Consumer Privacy Act & US Privacy Regulations',
          badge: 'Jurisdição Norte-Americana (CCPA / CPRA)',
          legalBases:
            'California Consumer Privacy Act (Cal. Civ. Code § 1798.100+) & CPRA Framework',
          overview:
            'O CCPA e a legislação de privacidade dos Estados Unidos garantem aos consumidores e residentes o direito de saber quais dados são coletados, solicitar a exclusão, optar pela não venda/compartilhamento de informações sensíveis e não sofrer discriminação pelo exercício de seus direitos.',
          rights:
            'Right to know / access personal information collected, right to delete personal information, right to correct inaccurate personal data, and right to opt-out of the sale or sharing of personal data ("Do Not Sell or Share My Personal Info").',
          dpoNote: `Privacy Compliance Team & US Representative: ${dpoEmail}`,
        }
      default:
        return {
          title: 'Padrão Internacional & Base Contratual Brasileira',
          badge: 'Jurisdição Internacional / Base Brasileira',
          legalBases:
            'Base contratual brasileira (Lei 13.709/2018) na ausência de leis locais equivalentes',
          overview:
            'Para usuários residentes em outros territórios soberanos, o 369TRAINING adota como padrão ético e técnico os princípios da Lei Geral de Proteção de Dados do Brasil (Lei 13.709/2018) combinados às melhores práticas internacionais de segurança da informação (ISO/IEC 27001 e criptografia em repouso e trânsito).',
          rights:
            'Garantia irrestrita de acesso, retificação, eliminação de dados de saúde e revogação de consentimentos.',
          dpoNote: `Encarregado Internacional de Privacidade (DPO): ${dpoEmail}`,
        }
    }
  }

  const jurisdiction = getJurisdictionInfo(selectedCountry)

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black font-inter">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <CrestLogo size={40} showText subText />
          </Link>
          <Link to="/">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-montserrat uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar ao Início
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-xs font-bold text-[#22C55E] uppercase font-montserrat mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              {jurisdiction.badge}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
              LGPD & Consentimentos do Titular
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Consulte seu histórico de consentimentos expressos, data/hora e revogue o tratamento
              de dados sensíveis de saúde conforme o Art. 18 da LGPD.
            </p>
          </div>

          {/* Seletor de Jurisdição */}
          <div className="bg-[#141414] border border-[#2A2A2A] p-3 rounded-2xl flex flex-col gap-1 sm:w-64 shrink-0">
            <label className="text-[10px] font-bold text-[#D4AF37] uppercase font-montserrat flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              País do Usuário / Jurisdição:
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            >
              <option value="Brasil">Brasil (LGPD)</option>
              <option value="Portugal">Portugal (GDPR)</option>
              <option value="Reino Unido">Reino Unido (UK GDPR)</option>
              <option value="Estados Unidos">Estados Unidos (CCPA)</option>
              <option value="Outro">Outro País (Base Brasileira)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20 space-y-6">
        {/* TABELA DE CONSENTIMENTOS DO USUÁRIO LOGADO */}
        {user ? (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#2A2A2A]">
              <div>
                <h2 className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#22C55E]" /> Seus Consentimentos Registrados
                </h2>
                <p className="text-xs text-gray-400 font-inter">
                  Histórico oficial de aceites vinculados à sua conta ({user.email}).
                </p>
              </div>
              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-0 text-xs font-mono self-start sm:self-auto">
                {consents.length} registro(s)
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" /> Carregando
                consentimentos...
              </div>
            ) : consents.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 space-y-2">
                <p>Nenhum consentimento específico registrado até o momento.</p>
                <p className="text-gray-500">
                  Ao navegar pelas áreas de treino, nutrição ou fisioterapia, você será solicitado a
                  conceder o consentimento destacado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-inter">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] text-gray-400 font-montserrat uppercase text-[10px]">
                      <th className="pb-3">Tipo / Documento</th>
                      <th className="pb-3">Versão</th>
                      <th className="pb-3">Data e Hora</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {consents.map((item) => {
                      const isSensitive =
                        item.document_slug === 'consentimento-dados-sensiveis-saude' ||
                        item.consent_type === 'dados_sensiveis_saude_art11'
                      const dateStr = item.accepted_at
                        ? new Date(item.accepted_at).toLocaleString('pt-BR')
                        : new Date(item.created).toLocaleString('pt-BR')

                      return (
                        <tr key={item.id} className="hover:bg-[#141414] transition-colors">
                          <td className="py-3 font-semibold text-white font-montserrat">
                            <div className="flex items-center gap-1.5">
                              {isSensitive ? (
                                <ShieldAlert className="w-4 h-4 text-[#D4AF37] shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
                              )}
                              <span>
                                {isSensitive
                                  ? 'Dados Sensíveis de Saúde (LGPD Art. 11)'
                                  : item.document_slug || item.consent_type}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-gray-300">v{item.version || 1}</td>
                          <td className="py-3 font-mono text-gray-400 text-[11px]">{dateStr}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
                              Vigente
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {isSensitive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRevokeConsent(item)}
                                disabled={revokingId === item.id}
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] font-bold uppercase h-8"
                              >
                                {revokingId === item.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Revogar
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-[10px] text-gray-500 italic">
                                Termo Geral Obrigatório
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold font-montserrat text-white text-sm uppercase">
                Consulte e Gerencie seus Consentimentos
              </h3>
              <p className="text-xs text-gray-400">
                Faça login para visualizar a lista completa de aceites e exercer seus direitos de
                titular (LGPD Art. 18).
              </p>
            </div>
            <Link to="/login">
              <Button className="bg-[#D4AF37] text-black font-bold text-xs uppercase">
                Entrar
              </Button>
            </Link>
          </Card>
        )}

        {/* Overview Card */}
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl text-gray-300 leading-relaxed text-sm space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] uppercase">
              {selectedCountry}
            </span>
            <h2 className="text-lg sm:text-xl font-bold font-montserrat text-white uppercase">
              {jurisdiction.title}
            </h2>
          </div>
          <p>{jurisdiction.overview}</p>
          <div className="p-3.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs space-y-1">
            <span className="font-bold text-[#D4AF37] font-montserrat uppercase block">
              Direitos Assegurados na sua Região:
            </span>
            <p className="text-gray-300">{jurisdiction.rights}</p>
          </div>
        </Card>

        {/* Card DPO e Retenção MCI Art. 15 */}
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl text-gray-300 text-xs sm:text-sm space-y-4">
          <h3 className="text-base font-bold font-montserrat text-white uppercase flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#D4AF37]" /> Encarregado pelo Tratamento de Dados (DPO) &
            Retenção Legal
          </h3>
          <p>
            O Encarregado pelo Tratamento de Dados Pessoais (DPO) da 369TRAINING atua como canal de
            comunicação entre o titular dos dados, a Autoridade Nacional de Proteção de Dados (ANPD)
            e a plataforma.
          </p>
          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-1 font-mono text-xs text-white">
            <p>
              <strong>Contato Oficial do DPO:</strong>{' '}
              <a href={`mailto:${dpoEmail}`} className="text-[#D4AF37] underline font-bold">
                {dpoEmail}
              </a>
            </p>
            <p className="text-gray-400">
              <strong>Responsável:</strong> {dpoName}
            </p>
            <p className="text-gray-400">
              <strong>Retenção de Registros de Acesso (MCI Art. 15):</strong> {retentionMonths}{' '}
              meses estritos em ambiente seguro e controlado.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link to="/politica-de-privacidade">
              <Button
                variant="outline"
                size="sm"
                className="border-[#2A2A2A] text-gray-300 text-xs"
              >
                Ler Política de Privacidade Completa
              </Button>
            </Link>
            <Link to="/termos-de-uso">
              <Button
                variant="outline"
                size="sm"
                className="border-[#2A2A2A] text-gray-300 text-xs"
              >
                Ler Termos de Uso
              </Button>
            </Link>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] bg-[#070707] py-6 px-6 text-center text-xs text-gray-500 font-inter">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} 369TRAINING LTDA. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-xs">
            <Link to="/termos-de-uso" className="text-gray-400 hover:text-[#D4AF37]">
              Termos de Uso
            </Link>
            <Link to="/politica-de-privacidade" className="text-gray-400 hover:text-[#D4AF37]">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
