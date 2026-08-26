import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Database,
  Eye,
  UserCheck,
  Mail,
  Globe,
  CheckCircle2,
} from 'lucide-react'

export default function PoliticaDePrivacidade() {
  const { user } = useAuth()
  const [selectedCountry, setSelectedCountry] = useState<string>(user?.country || 'Brasil')

  const getJurisdictionDetails = (country: string) => {
    switch (country) {
      case 'Brasil':
        return {
          lawTitle: 'LGPD — Lei Federal nº 13.709/2018 (Brasil)',
          authority: 'Autoridade Nacional de Proteção de Dados (ANPD)',
          description:
            'Aplica-se a qualquer operação de tratamento de dados realizada por pessoa natural ou jurídica no território brasileiro, ou voltada à oferta de bens/serviços no Brasil.',
          badge: 'LGPD (Brasil)',
        }
      case 'Portugal':
      case 'Reino Unido':
        return {
          lawTitle: 'GDPR (Regulamento UE 2016/679) / UK GDPR (Data Protection Act 2018)',
          authority: 'Comissão Nacional de Proteção de Dados (CNPD / ICO)',
          description:
            'Aplica-se ao tratamento de dados pessoais de residentes no Espaço Econômico Europeu e no Reino Unido, garantindo os princípios de licitude, lealdade, transparência e minimização dos dados.',
          badge: 'GDPR / UK GDPR',
        }
      case 'Estados Unidos':
        return {
          lawTitle: 'CCPA / CPRA — California Consumer Privacy Act & US Privacy Standard',
          authority: 'California Privacy Protection Agency (CPPA) / Federal Trade Commission (FTC)',
          description:
            'Garante aos residentes nos EUA o direito de transparência na coleta de dados, proibição de venda não autorizada ("Do Not Sell"), e direitos de acesso e eliminação irrestritos.',
          badge: 'CCPA / US Privacy',
        }
      case 'Canadá':
        return {
          lawTitle: 'PIPEDA — Personal Information Protection and Electronic Documents Act',
          authority: 'Office of the Privacy Commissioner of Canada (OPC)',
          description:
            'Rege o tratamento e privacidade de dados no setor comercial privado do Canadá, exigindo consentimento explícito e salvaguardas rigorosas.',
          badge: 'PIPEDA (Canadá)',
        }
      case 'Austrália':
        return {
          lawTitle: 'Privacy Act 1988 & Australian Privacy Principles (APPs)',
          authority: 'Office of the Australian Information Commissioner (OAIC)',
          description:
            'Rege a proteção de informações pessoais e diretrizes mandatórias de notificação para residentes na Austrália.',
          badge: 'Privacy Act (Austrália)',
        }
      default:
        return {
          lawTitle: 'Base Contratual Brasileira & Padrão Internacional de Proteção de Dados',
          authority: 'Arbitragem & Proteção Internacional 369TRAINING',
          description:
            'Para jurisdições sem regramento cogente equivalente, a relação jurídica rege-se subsidiariamente pela legislação de proteção de dados brasileira (Lei nº 13.709/2018) com padrões globais de criptografia e transparência.',
          badge: 'Base Internacional',
        }
    }
  }

  const jur = getJurisdictionDetails(selectedCountry)
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              {jur.badge} — Legislação Aplicável
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
              Política de Privacidade
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Vigência e última atualização: {new Date().toLocaleDateString('pt-BR')} • País:{' '}
              <strong className="text-[#D4AF37]">{selectedCountry}</strong>
            </p>
          </div>

          {/* Jurisdição / Seletor de País */}
          <div className="bg-[#141414] border border-[#2A2A2A] p-3 rounded-2xl flex flex-col gap-1 sm:w-64 shrink-0">
            <label className="text-[10px] font-bold text-[#D4AF37] uppercase font-montserrat flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Seu País / Jurisdição:
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0057FF]"
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
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-10 rounded-2xl space-y-8 text-gray-300 leading-relaxed text-sm">
          {/* Seção 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">1.</span> Introdução e Compromisso com a Sua
              Jurisdição
            </h2>
            <div className="p-4 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0057FF]" />
                <span className="font-bold text-white uppercase font-montserrat">
                  Legislação Aplicável para {selectedCountry}: {jur.lawTitle}
                </span>
              </div>
              <p className="text-gray-300">{jur.description}</p>
              <p className="text-[11px] text-gray-400">
                Autoridade Reguladora de Referência:{' '}
                <strong className="text-white">{jur.authority}</strong>
              </p>
            </div>
            <p>
              A <strong className="text-white">369TRAINING LTDA</strong> (&ldquo;369TRAINING&rdquo;,
              &ldquo;nós&rdquo; ou &ldquo;plataforma&rdquo;) valoriza profundamente a privacidade e
              a proteção dos dados pessoais de seus Usuários (Alunos, Profissionais de Saúde e
              Parceiros). Esta Política de Privacidade explica com clareza e transparência como
              coletamos, usamos, armazenamos, tratamos e protegemos seus dados pessoais em estrita
              observância à legislação aplicável ao seu país de residência cadastrado.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">2.</span> Dados Pessoais Coletados
            </h2>
            <p>Coletamos as seguintes categorias de informações:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-1">
                <span className="text-xs font-bold text-[#D4AF37] font-montserrat uppercase">
                  Dados Cadastrais & Identificação
                </span>
                <p className="text-xs text-gray-400">
                  Nome completo, e-mail, telefone/WhatsApp, foto de perfil, CPF, senha criptografada
                  e código de indicação.
                </p>
              </div>

              <div className="p-4 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-1">
                <span className="text-xs font-bold text-[#D4AF37] font-montserrat uppercase">
                  Dados de Habilitação Profissional
                </span>
                <p className="text-xs text-gray-400">
                  Número de registro em conselho de classe (CREF, CRN, CREFITO), especialidades,
                  biografia, vídeo de apresentação e tipo de atuação (PF/MEI).
                </p>
              </div>

              <div className="p-4 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-1">
                <span className="text-xs font-bold text-[#D4AF37] font-montserrat uppercase">
                  Geolocalização & Endereço
                </span>
                <p className="text-xs text-gray-400">
                  Cidade, estado e coordenadas geográficas (latitude/longitude) para permitir que
                  alunos encontrem profissionais próximos no raio de busca.
                </p>
              </div>

              <div className="p-4 bg-[#181818] border border-[#2A2A2A] rounded-xl space-y-1">
                <span className="text-xs font-bold text-[#D4AF37] font-montserrat uppercase">
                  Dados de Saúde & Treino (Sensíveis)
                </span>
                <p className="text-xs text-gray-400">
                  Objetivos físicos, histórico de lesões, nível de dor (EVA), testes de mobilidade,
                  histórico de treinos e planejamento nutricional.
                </p>
              </div>
            </div>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">3.</span> Finalidade e Bases Legais do Tratamento
            </h2>
            <p>
              O tratamento de seus dados apoia-se nas seguintes bases legais reconhecidas na
              jurisdição de {selectedCountry}:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              <li>
                <strong className="text-white">
                  Execução de Contrato & Prestação de Serviços:
                </strong>{' '}
                Para viabilizar a criação de contas, agendamentos de sessões, prescrição de treinos,
                processamento de pagamentos e repasses de cashback na carteira digital (Art. 7º, V
                LGPD / Art. 6(1)(b) GDPR / CCPA Contract Performance).
              </li>
              <li>
                <strong className="text-white">Consentimento Expresso & Explícito:</strong> Para o
                tratamento de dados sensíveis de saúde física, nutrição, testes de mobilidade e
                recebimento de comunicações institucionais (Art. 11, I LGPD / Art. 9(2)(a) GDPR).
              </li>
              <li>
                <strong className="text-white">
                  Cumprimento de Obrigação Legal e Regulatória:
                </strong>{' '}
                Validação e auditoria de registros de classe profissional (CREF/CRN/CRP/CREFITO) e
                emissão de registros fiscais e contábeis.
              </li>
              <li>
                <strong className="text-white">Legítimo Interesse / Legitimate Interests:</strong>{' '}
                Para aprimoramento contínuo dos algoritmos de recomendação com IA, prevenção a
                fraudes e segurança da informação.
              </li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">4.</span> Compartilhamento e Infraestrutura de Dados
            </h2>
            <p>
              A 369TRAINING não comercializa nem transfere seus dados pessoais a terceiros para fins
              publicitários independentes. O compartilhamento ocorre estritamente com parceiros
              operacionais essenciais:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>
                <strong className="text-white">
                  Infraestrutura em Nuvem (PocketBase / Skip Cloud):
                </strong>{' '}
                Para armazenamento seguro em banco de dados isolado com criptografia em repouso e
                trânsito (SSL/TLS).
              </li>
              <li>
                <strong className="text-white">Profissionais Conectados:</strong> Os dados de treino
                e saúde do aluno são acessíveis somente aos profissionais contratados ou autorizados
                pelo próprio aluno.
              </li>
            </ul>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">5.</span> Seções Específicas por Jurisdição &
              Direitos do Titular
            </h2>
            <p>
              Garantimos aos titulares os direitos previstos em suas leis locais de proteção à
              privacidade:
            </p>

            {/* Subseções Jurisdicionais */}
            <div className="space-y-3 pt-2">
              {/* LGPD Brasil */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5">
                <span className="text-xs font-bold text-[#22C55E] uppercase font-montserrat flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Jurisdição Brasil — LGPD (Lei nº
                  13.709/2018)
                </span>
                <p className="text-xs text-gray-300">
                  Direitos de confirmação de existência de tratamento, acesso aos dados, correção de
                  dados incompletos/inexatos, anonimização ou bloqueio de dados desnecessários,
                  portabilidade dos dados, eliminação dos dados tratados com consentimento e
                  revogação formal (Art. 18).
                </p>
              </div>

              {/* GDPR Europa & UK */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5">
                <span className="text-xs font-bold text-[#0057FF] uppercase font-montserrat flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Jurisdição União Europeia & UK — GDPR
                  (Regulation EU 2016/679)
                </span>
                <p className="text-xs text-gray-300">
                  Garantia de Right to Access (Art. 15), Right to Rectification (Art. 16), Right to
                  Erasure / Right to be Forgotten (Art. 17), Right to Restriction of Processing
                  (Art. 18), Data Portability (Art. 20) e Right to Object to automated
                  decision-making (Art. 21 e 22).
                </p>
              </div>

              {/* CCPA Estados Unidos */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5">
                <span className="text-xs font-bold text-[#D4AF37] uppercase font-montserrat flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Jurisdição Estados Unidos — CCPA / CPRA &
                  State Laws
                </span>
                <p className="text-xs text-gray-300">
                  Right to Know categories of personal information collected, Right to Delete
                  personal information collected, Right to Correct inaccurate personal data, Right
                  to Opt-Out of sale or sharing, e garantia de Não-Discriminação por exercer
                  direitos de privacidade.
                </p>
              </div>

              {/* Canadá & Austrália */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-1.5">
                <span className="text-xs font-bold text-gray-300 uppercase font-montserrat flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Jurisdição Canadá (PIPEDA) & Austrália
                  (Privacy Act 1988)
                </span>
                <p className="text-xs text-gray-300">
                  Consentimento informado para fins comerciais específicos, salvaguardas rigorosas
                  para dados de saúde sensíveis e canais expeditos de contestação e retificação.
                </p>
              </div>
            </div>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">6.</span> Política de Cookies e Armazenamento Local
            </h2>
            <p>
              Utilizamos cookies e tecnologias similares (como localStorage) para finalidades
              estritamente essenciais:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>
                <strong className="text-white">Cookies de Sessão e Autenticação:</strong> Para
                manter o Usuário conectado de forma segura à sua conta.
              </li>
              <li>
                <strong className="text-white">Cookies de Preferência:</strong> Armazenar o
                consentimento aos termos e preferências de interface.
              </li>
            </ul>
          </section>

          {/* Seção 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">7.</span> Segurança da Informação
            </h2>
            <p>
              Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais contra
              acessos não autorizados, destruição, perda, alteração ou qualquer forma de tratamento
              inadequado, incluindo senhas com hash seguro (bcrypt/argon2), tokens JWT com prazo de
              expiração e regras de controle de acesso (Row Level Security).
            </p>
          </section>

          {/* Seção 8 */}
          <section className="space-y-3 pt-4 border-t border-[#2A2A2A]">
            <h2 className="text-base font-bold font-montserrat text-[#0057FF] uppercase flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0057FF]" />
              Encarregado de Proteção de Dados (DPO)
            </h2>
            <p className="text-xs text-gray-400">
              Para exercer qualquer um dos seus direitos previstos pela LGPD, sanar dúvidas ou
              enviar reclamações sobre esta política, entre em contato direto com o nosso
              Encarregado pelo Tratamento de Dados Pessoais (DPO):
            </p>
            <div className="p-4 bg-[#181818] border border-[#2A2A2A] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-white font-montserrat">DPO 369TRAINING</p>
                <p className="text-gray-400">Encarregado Oficial de Proteção de Dados</p>
              </div>
              <a
                href="mailto:dpo@369training.com"
                className="px-4 py-2 rounded-lg bg-[#0057FF] text-white font-bold hover:bg-[#1a6aff] transition-all"
              >
                dpo@369training.com
              </a>
            </div>
          </section>
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
            <Link to="/lgpd-consentimentos" className="text-gray-400 hover:text-[#D4AF37]">
              LGPD & Consentimentos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
