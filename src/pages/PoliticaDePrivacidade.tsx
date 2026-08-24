import React from 'react'
import { Link } from 'react-router-dom'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Lock, ArrowLeft, Database, Eye, UserCheck, Mail } from 'lucide-react'

export default function PoliticaDePrivacidade() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/15 border border-[#0057FF]/40 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
          Política de Privacidade — 369TRAINING
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Vigência e última atualização: {new Date().toLocaleDateString('pt-BR')} • Brasil
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-10 rounded-2xl space-y-8 text-gray-300 leading-relaxed text-sm">
          {/* Seção 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <span className="text-[#0057FF]">1.</span> Introdução e Compromisso
            </h2>
            <p>
              A <strong className="text-white">369TRAINING LTDA</strong> (&ldquo;369TRAINING&rdquo;,
              &ldquo;nós&rdquo; ou &ldquo;plataforma&rdquo;) valoriza profundamente a privacidade e
              a proteção dos dados pessoais de seus Usuários (Alunos, Profissionais de Saúde e
              Parceiros). Esta Política de Privacidade explica com clareza e transparência como
              coletamos, usamos, armazenamos, tratamos e protegemos seus dados pessoais em estrita
              observância à Lei Geral de Proteção de Dados Pessoais (LGPD — Lei Federal nº
              13.709/2018).
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
              (Art. 7º e 11 da LGPD)
            </h2>
            <p>O tratamento de seus dados apoia-se nas seguintes bases legais:</p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              <li>
                <strong className="text-white">Execução de Contrato (Art. 7º, V):</strong> Para
                viabilizar a criação de contas, agendamentos de sessões, prescrição de treinos,
                processamento de pagamentos PIX e repasses de cashback na carteira digital.
              </li>
              <li>
                <strong className="text-white">
                  Consentimento Expresso (Art. 7º, I e Art. 11, I):
                </strong>{' '}
                Para o tratamento de dados de saúde física, nutrição, preferências e recebimento de
                comunicações institucionais.
              </li>
              <li>
                <strong className="text-white">
                  Cumprimento de Obrigação Legal e Regulatória (Art. 7º, II):
                </strong>{' '}
                Validação e auditoria de registros de classe profissional (CREF/CRN/CREFITO) e
                emissão de registros fiscais.
              </li>
              <li>
                <strong className="text-white">Legítimo Interesse (Art. 7º, IX):</strong> Para
                aprimoramento contínuo dos algoritmos de recomendação com IA, prevenção a fraudes e
                segurança da informação.
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
              <span className="text-[#0057FF]">5.</span> Direitos do Titular de Dados (Art. 18 da
              LGPD)
            </h2>
            <p>
              Conforme previsto pela LGPD, você possui os seguintes direitos a qualquer momento:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Confirmação e Acesso:</span> Saber se
                tratamos seus dados e solicitar cópia integral.
              </div>
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Correção:</span> Retificar dados
                incompletos, inexatos ou desatualizados.
              </div>
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Anonimização ou Bloqueio:</span> De dados
                desnecessários ou tratados em desconformidade.
              </div>
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Portabilidade:</span> Transferir seus dados
                a outro fornecedor de serviço.
              </div>
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Eliminação:</span> Solicitar a exclusão
                definitiva dos dados tratados com consentimento.
              </div>
              <div className="p-2.5 bg-[#181818] border border-[#2A2A2A] rounded-lg">
                <span className="font-bold text-white">✓ Revogação de Consentimento:</span> Retirar
                o consentimento previamente fornecido.
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
