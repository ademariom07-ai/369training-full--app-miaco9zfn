import React from 'react'
import { Link } from 'react-router-dom'
import { CrestLogo } from '@/components/CrestLogo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Sparkles,
  Users,
  Trophy,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  BrainCircuit,
  HeartHandshake,
  PieChart,
  Award,
} from 'lucide-react'

export default function Index() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black overflow-x-hidden">
      {/* Background Glows and Radial Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#0057FF]/15 rounded-full blur-[80px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#D4AF37]/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.03]" />
      </div>

      {/* Top Bar for Landing */}
      <header className="relative z-10 border-b border-[#2A2A2A]/60 backdrop-blur-md bg-[#0A0A0A]/80 sticky top-0 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <CrestLogo size={42} showText subText />
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button
              variant="ghost"
              className="text-gray-300 hover:text-[#D4AF37] hover:bg-white/5 font-semibold text-sm"
            >
              Entrar
            </Button>
          </Link>
          <Link to="/cadastro">
            <Button className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-semibold text-sm shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all">
              Criar Conta
            </Button>
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-16 pb-24 px-6 max-w-5xl mx-auto text-center flex flex-col items-center opacity-[1] bg-transparent rounded-[0px]">
        {/* Crest Medallion with Pulse Glow */}
        <div className="mb-8 relative drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">
          <CrestLogo size={140} />
        </div>

        {/* Brand Headline */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181818] border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37] mb-6 tracking-wide uppercase font-montserrat">
          <Sparkles className="w-3.5 h-3.5" />
          Ecossistema Integrado de Performance & Saúde
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight font-montserrat uppercase mb-4 gold-gradient-text">
          369 TRAINING
        </h1>

        <p className="text-xl sm:text-2xl font-bold gold-gradient-text tracking-widest uppercase font-montserrat mb-6">
          FOCO • LEGADO • ESTRATÉGIA
        </p>

        {/* Tesla Quote Banner */}
        <div className="relative max-w-2xl px-6 py-4 rounded-xl bg-[#141414]/90 border border-[#2A2A2A] text-gray-300 italic text-sm sm:text-base font-inter mb-10 shadow-2xl">
          <p>
            &ldquo;Se você soubesse a magnificência dos números 3, 6 e 9, teria a chave do
            universo.&rdquo;
          </p>
          <span className="block text-xs font-semibold text-[#D4AF37] mt-2 not-italic tracking-wider uppercase">
            — Nikola Tesla
          </span>
        </div>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link to="/cadastro?tipo=profissional" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto px-8 py-6 text-base font-bold bg-[#D4AF37] text-black hover:bg-[#E6C65C] rounded-xl shadow-[0_0_30px_rgba(212,175,55,0.35)] hover:scale-105 transition-all">
              Sou Profissional
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/cadastro?tipo=aluno" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto px-8 py-6 text-base font-bold text-white border-[#0057FF] hover:bg-[#0057FF]/10 hover:border-[#0057FF] rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,87,255,0.2)]"
            >
              Sou Aluno
            </Button>
          </Link>
        </div>
      </section>

      {/* PILLARS SECTION (3 CARDS) */}
      <section className="relative z-10 py-16 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold font-montserrat gold-gradient-text uppercase">
            Os 3 Pilares da Excelência
          </h2>
          <p className="text-gray-400 text-sm mt-2 font-inter">
            Tecnologia de ponta e conexão humana para transformar sua jornada fitness
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Treino com IA */}
          <Card className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/70 p-8 rounded-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] group">
            <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-6 text-[#D4AF37] group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-montserrat text-white mb-3">
              Treino & Nutrição com IA
            </h3>
            <p className="text-gray-400 text-sm font-inter leading-relaxed">
              Algoritmos biomecânicos geram prescrições individualizadas, substituições nutricionais
              inteligentes e protocolos de recuperação instantâneos.
            </p>
          </Card>

          {/* Card 2: Rede de Profissionais */}
          <Card className="bg-[#181818] border border-[#2A2A2A] hover:border-[#0057FF]/70 p-8 rounded-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(0,87,255,0.15)] group">
            <div className="w-14 h-14 rounded-xl bg-[#0057FF]/10 border border-[#0057FF]/30 flex items-center justify-center mb-6 text-[#0057FF] group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-montserrat text-white mb-3">
              Rede de Profissionais
            </h3>
            <p className="text-gray-400 text-sm font-inter leading-relaxed">
              Localize personais, nutricionistas, fisioterapeutas e mestres de artes marciais
              certificados por geolocalização com avaliações verificadas.
            </p>
          </Card>

          {/* Card 3: Ranking & Cashback */}
          <Card className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/70 p-8 rounded-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] group">
            <div className="w-14 h-14 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mb-6 text-[#D4AF37] group-hover:scale-110 transition-transform">
              <Trophy className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-montserrat text-white mb-3">
              Ranking & Cashback 36 Níveis
            </h3>
            <p className="text-gray-400 text-sm font-inter leading-relaxed">
              Sistema de distribuição hierárquica em árvore binária com 38% de pool de parceiros e 4
              metas de impacto ESG sustentável.
            </p>
          </Card>
        </div>
      </section>

      {/* COMO FUNCIONA (4 STEPS) */}
      <section className="relative z-10 py-16 px-6 max-w-6xl mx-auto bg-[#141414]/50 border border-[#2A2A2A]/50 rounded-2xl my-12">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest font-montserrat">
            Simples e Poderoso
          </span>
          <h2 className="text-3xl font-bold font-montserrat text-white uppercase mt-1">
            Como Funciona o 369TRAINING
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[#181818] border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] font-bold font-montserrat text-lg mb-4 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              1
            </div>
            <h4 className="font-bold text-white mb-2 font-montserrat">Cadastre-se</h4>
            <p className="text-xs text-gray-400 font-inter">
              Crie seu perfil como Aluno ou Profissional verificado em menos de 2 minutos.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[#181818] border-2 border-[#0057FF] flex items-center justify-center text-[#0057FF] font-bold font-montserrat text-lg mb-4 shadow-[0_0_15px_rgba(0,87,255,0.3)]">
              2
            </div>
            <h4 className="font-bold text-white mb-2 font-montserrat">Conecte-se</h4>
            <p className="text-xs text-gray-400 font-inter">
              Encontre o especialista ideal perto de você ou receba alunos diretamente no
              BackOffice.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[#181818] border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] font-bold font-montserrat text-lg mb-4 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              3
            </div>
            <h4 className="font-bold text-white mb-2 font-montserrat">Treine e Evolua</h4>
            <p className="text-xs text-gray-400 font-inter">
              Acesse treinos personalizados, dietas, protocolos e acompanhe sua evolução em tempo
              real.
            </p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-[#181818] border-2 border-[#FF7A00] flex items-center justify-center text-[#FF7A00] font-bold font-montserrat text-lg mb-4 shadow-[0_0_15px_rgba(255,122,0,0.3)]">
              4
            </div>
            <h4 className="font-bold text-white mb-2 font-montserrat">Ganhe Cashback</h4>
            <p className="text-xs text-gray-400 font-inter">
              Suba no ranking 369, acumule cashback direto na carteira digital e impacte causas ESG.
            </p>
          </div>
        </div>
      </section>

      {/* RANKING & CASHBACK TEASER (38% POOL & ESG METAS) */}
      <section className="relative z-10 py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest font-montserrat">
              Árvore Binária de 36 Níveis
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-montserrat uppercase gold-gradient-text mt-1 mb-4">
              Pool de Parceiros 38% & Metas ESG
            </h2>
            <p className="text-gray-300 font-inter text-sm sm:text-base leading-relaxed mb-6">
              A 369TRAINING revoluciona o mercado de saúde ao redistribuir{' '}
              <strong className="text-white font-semibold">38% de todo o pool de serviços</strong>{' '}
              aos profissionais e alunos da rede através de um algoritmo de cashback multinível
              transparente.
            </p>

            <div className="space-y-3 font-inter text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#181818] border border-[#2A2A2A]">
                <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
                <span className="text-gray-300">
                  Auditoria imutável de pontuação por estrelas, serviços e indicações.
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#181818] border border-[#2A2A2A]">
                <Zap className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-gray-300">
                  Tarifas ultrabaixas (R$ 1 a R$ 3) por atendimento concluído.
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#181818] border border-[#2A2A2A]">
                <HeartHandshake className="w-5 h-5 text-[#0057FF]" />
                <span className="text-gray-300">
                  Impacto direto em projetos sociais e sustentabilidade ecológica.
                </span>
              </div>
            </div>
          </div>

          {/* ESG Metas Visual Breakdown */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-bold font-montserrat text-white mb-6 flex items-center justify-between">
              <span>Distribuição das 4 Metas ESG</span>
              <span className="text-xs text-[#D4AF37] font-semibold uppercase px-2.5 py-1 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                100% Auditável
              </span>
            </h3>

            <div className="space-y-4">
              {/* Meta 1: Econômica 55% */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-white">Meta Econômica (Carteira do Parceiro)</span>
                  <span className="text-[#D4AF37]">55%</span>
                </div>
                <div className="w-full h-3 bg-[#141414] rounded-full overflow-hidden border border-[#2A2A2A]">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D77A] rounded-full"
                    style={{ width: '55%' }}
                  />
                </div>
              </div>

              {/* Meta 2: Social 15% */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-white">Meta Social (Inclusão Esportiva Comunitária)</span>
                  <span className="text-[#0057FF]">15%</span>
                </div>
                <div className="w-full h-3 bg-[#141414] rounded-full overflow-hidden border border-[#2A2A2A]">
                  <div className="h-full bg-[#0057FF] rounded-full" style={{ width: '15%' }} />
                </div>
              </div>

              {/* Meta 3: Ecológica 15% */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-white">Meta Ecológica (Projetos Verdes & Preservação)</span>
                  <span className="text-[#22C55E]">15%</span>
                </div>
                <div className="w-full h-3 bg-[#141414] rounded-full overflow-hidden border border-[#2A2A2A]">
                  <div className="h-full bg-[#22C55E] rounded-full" style={{ width: '15%' }} />
                </div>
              </div>

              {/* Meta 4: Bônus 15% */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-white">Meta Bônus (Superação de Metas & Mérito)</span>
                  <span className="text-[#FF7A00]">15%</span>
                </div>
                <div className="w-full h-3 bg-[#141414] rounded-full overflow-hidden border border-[#2A2A2A]">
                  <div className="h-full bg-[#FF7A00] rounded-full" style={{ width: '15%' }} />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#2A2A2A] text-center">
              <Link to="/cadastro">
                <Button className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold">
                  Entrar no Ecossistema 369
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#2A2A2A] bg-[#0B0B0C] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <CrestLogo size={48} showText subText />
            <p className="text-xs text-gray-500 mt-3 font-inter max-w-sm">
              Plataforma de alta performance para profissionais e alunos de Educação Física,
              Nutrição, Fisioterapia e Artes Marciais.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 font-inter">
            <Link to="/termos-de-uso" className="hover:text-[#D4AF37] transition-colors">
              Termos de Uso
            </Link>
            <Link to="/politica-de-privacidade" className="hover:text-[#D4AF37] transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/lgpd-consentimentos" className="hover:text-[#D4AF37] transition-colors">
              LGPD & Consentimentos
            </Link>
            <a
              href="mailto:suporte@369training.com"
              className="hover:text-[#D4AF37] transition-colors"
            >
              Suporte 369
            </a>
          </div>

          <div className="text-center md:text-right text-xs text-gray-600 font-inter">
            © {new Date().getFullYear()} 369TRAINING. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
