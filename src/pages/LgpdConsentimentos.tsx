import React from 'react'
import { Link } from 'react-router-dom'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ShieldCheck, ArrowLeft, CheckCircle2, Lock, Bell, MapPin, Database } from 'lucide-react'

export default function LgpdConsentimentos() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-xs font-bold text-[#22C55E] uppercase font-montserrat mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Transparência & Gestão de Consentimentos
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
          LGPD & Consentimentos — 369TRAINING
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Entenda como seus consentimentos funcionam e como seus dados são geridos na plataforma.
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <div className="space-y-6">
          {/* Overview Card */}
          <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl text-gray-300 leading-relaxed text-sm space-y-4">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase">
              O que é a LGPD e por que solicitamos seus consentimentos?
            </h2>
            <p>
              A{' '}
              <strong className="text-white">
                Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
              </strong>{' '}
              estabelece regras claras para a coleta, armazenamento, tratamento e compartilhamento
              de dados pessoais no Brasil, garantindo ao cidadão maior controle e transparência
              sobre suas informações.
            </p>
            <p>
              No ecossistema <strong className="text-white">369TRAINING</strong>, tratamos dados
              necessários para gerar prescrições com IA, conectar alunos e profissionais de saúde
              com registro validado (CREF, CRN, CREFITO), processar pagamentos seguros e distribuir
              cashback na carteira digital.
            </p>
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
                  Status: Obrigatório para a prestação dos serviços contratados (Art. 7º, V e Art.
                  11, I da LGPD).
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
              nosso DPO oficial pelo e-mail{' '}
              <a
                href="mailto:dpo@369training.com"
                className="text-[#D4AF37] underline font-semibold"
              >
                dpo@369training.com
              </a>
              .
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
