import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Bell,
  MapPin,
  Database,
  Globe,
} from 'lucide-react'

export default function LgpdConsentimentos() {
  const { user } = useAuth()
  const [selectedCountry, setSelectedCountry] = useState<string>(user?.country || 'Brasil')

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
          dpoNote:
            'Encarregado pelo Tratamento de Dados Pessoais (DPO Brasil): dpo@369training.com',
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
          dpoNote: 'Data Protection Officer (DPO / Lead Representative): dpo@369training.com',
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
          dpoNote: 'Privacy Compliance Team & US Representative: dpo@369training.com',
        }
      case 'Canadá':
        return {
          title: 'PIPEDA — Personal Information Protection and Electronic Documents Act',
          badge: 'Jurisdição Canadense (PIPEDA)',
          legalBases:
            'Personal Information Protection and Electronic Documents Act (PIPEDA, S.C. 2000, c. 5)',
          overview:
            'O PIPEDA rege como as empresas do setor privado coletam, usam e divulgam informações pessoais no curso de atividades comerciais no Canadá, garantindo o consentimento significativo e finalidades legítimas.',
          rights:
            'Direito de acesso aos dados mantidos, contestação da exatidão e integridade das informações, e solicitação de alterações ou exclusão.',
          dpoNote: 'Privacy Officer Canada: dpo@369training.com',
        }
      case 'Austrália':
        return {
          title: 'Privacy Act 1988 & Australian Privacy Principles (APPs)',
          badge: 'Jurisdição Australiana (Privacy Act)',
          legalBases: 'Australian Privacy Principles (Privacy Act 1988)',
          overview:
            'Os Australian Privacy Principles (APPs) regulam a gestão transparente de dados pessoais, padrões de coleta e armazenamento seguro para usuários domiciliados na Austrália.',
          rights:
            'Direito de acesso e retificação de informações pessoais e diretrizes rigorosas sobre notificação de incidentes de dados.',
          dpoNote: 'Privacy Officer Australia: dpo@369training.com',
        }
      default:
        return {
          title: 'Padrão Internacional & Base Contratual Brasileira',
          badge: 'Jurisdição Internacional / Base Brasileira',
          legalBases:
            'Base contratual brasileira (Lei 13.709/2018) na ausência de leis locais equivalentes',
          overview:
            'Para usuários residentes em outros territórios soberanos, o 369TRAINING adota como padrão ético e técnico os princípios da Lei Geral de Proteção de Dados do Brasil (Lei 13.709/2018) combinados às melhores práticas internacionais de segurança da informação (ISO/IEC 27001 e criptografia em repouso e trânsito), garantindo a base contratual brasileira na ausência de tratados cogentes locais em contrário.',
          rights:
            'Garantia irrestrita de acesso, retificação, eliminação de dados de saúde e revogação de consentimentos.',
          dpoNote: 'Encarregado Internacional de Privacidade: dpo@369training.com',
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
              LGPD & Consentimentos por País
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Transparência, gestão de dados pessoais e diretrizes legais adaptadas à sua
              jurisdição.
            </p>
          </div>

          {/* Seletor de Jurisdição / País */}
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
              <option value="Canadá">Canadá (PIPEDA)</option>
              <option value="Austrália">Austrália (Privacy Act)</option>
              <option value="Outro">Outro País (Base Brasileira)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {/* Overview Card Adaptativo */}
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
            <p>
              No ecossistema <strong className="text-white">369TRAINING</strong>, tratamos dados
              necessários para gerar prescrições com IA, conectar alunos e profissionais de saúde
              com registro validado (CREF, CRN, CRP, CREFITO), processar pagamentos seguros e
              distribuir cashback na carteira digital.
            </p>
            <div className="p-3.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#D4AF37] font-montserrat uppercase block">
                Direitos Assegurados na sua Região:
              </span>
              <p className="text-gray-300">{jurisdiction.rights}</p>
            </div>
          </Card>

          {/* Consentimentos Explicativos (Visual Checkboxes) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold font-montserrat text-[#D4AF37] uppercase">
              Quadro de Consentimentos do Ecossistema
            </h3>

            {/* Item 1: Dados Pessoais e de Saúde */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-[#0057FF]/10 rounded-xl border border-[#0057FF]/30 text-[#0057FF] shrink-0 mt-1">
                <Database className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked
                    disabled
                    className="data-[state=checked]:bg-[#22C55E] data-[state=checked]:border-[#22C55E]"
                  />
                  <h4 className="text-base font-bold font-montserrat text-white">
                    1. Consentimento para Tratamento de Dados Cadastrais e de Saúde
                  </h4>
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-gray-200">Finalidade:</strong> Criação de perfil,
                  identificação no app, geração de treinos físicos por Inteligência Artificial,
                  dietas nutricionais personalizadas, avaliação de dor/mobilidade e controle da
                  carteira digital.
                </p>
                <p className="text-[11px] text-[#22C55E] font-semibold">
                  Status: Obrigatório para a prestação dos serviços contratados (
                  {jurisdiction.legalBases}).
                </p>
              </div>
            </Card>

            {/* Item 2: Geolocalização */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/30 text-[#D4AF37] shrink-0 mt-1">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked
                    disabled
                    className="data-[state=checked]:bg-[#22C55E] data-[state=checked]:border-[#22C55E]"
                  />
                  <h4 className="text-base font-bold font-montserrat text-white">
                    2. Consentimento para Coleta de Geolocalização
                  </h4>
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-gray-200">Finalidade:</strong> Permitir a busca e conexão
                  entre alunos e profissionais em um raio geográfico próximo (cidade, estado e
                  coordenadas), facilitando atendimentos presenciais e consultorias híbridas.
                </p>
                <p className="text-[11px] text-[#22C55E] font-semibold">
                  Status: Ativo mediante autorização do dispositivo/cadastro. Pode ser atualizado a
                  qualquer momento no perfil.
                </p>
              </div>
            </Card>

            {/* Item 3: Comunicações e Alertas */}
            <Card className="bg-[#181818] border border-[#2A2A2A] p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/30 text-[#22C55E] shrink-0 mt-1">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked
                    disabled
                    className="data-[state=checked]:bg-[#22C55E] data-[state=checked]:border-[#22C55E]"
                  />
                  <h4 className="text-base font-bold font-montserrat text-white">
                    3. Consentimento para Notificações & Comunicações Operacionais
                  </h4>
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-gray-200">Finalidade:</strong> Envio de avisos de
                  agendamentos, confirmações de recarga PIX, notificações de recebimento de cashback
                  na rede, mensagens no chat interno e atualizações de segurança.
                </p>
                <p className="text-[11px] text-[#22C55E] font-semibold">
                  Status: Notificações operacionais essenciais e avisos da rede 369.
                </p>
              </div>
            </Card>
          </div>

          {/* Revogação e Contato */}
          <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl text-gray-300 text-xs sm:text-sm space-y-4">
            <h3 className="text-base font-bold font-montserrat text-white uppercase">
              Como alterar ou revogar meus consentimentos?
            </h3>
            <p>
              Você pode solicitar a alteração dos seus dados, a exclusão da sua conta ou a revogação
              de consentimentos não essenciais diretamente em seu perfil ou entrando em contato com
              nosso encarregado de dados pelo e-mail{' '}
              <a
                href="mailto:dpo@369training.com"
                className="text-[#D4AF37] underline font-semibold"
              >
                dpo@369training.com
              </a>
              . ({jurisdiction.dpoNote})
            </p>
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
        </div>
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
