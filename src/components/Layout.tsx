import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { CrestLogo } from '@/components/CrestLogo'
import { Button } from '@/components/ui/button'
import {
  Bell,
  LogOut,
  Menu,
  X,
  Home,
  Dumbbell,
  Users,
  MessageSquare,
  User,
  Activity,
  Award,
  Wallet,
  ShieldCheck,
  FileCheck2,
  Trophy,
  Sliders,
  ChevronDown,
  FileText,
} from 'lucide-react'
import type { NotificationRecord } from '@/services/api'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Notifications
  useEffect(() => {
    if (!user) return

    pb.collection('notifications')
      .getList<NotificationRecord>(1, 20, {
        filter: `user = "${user.id}" && read = false`,
      })
      .then((res) => {
        setUnreadCount(res.totalItems)
      })
      .catch(() => {})

    const unsub = pb.collection('notifications').subscribe('*', (e) => {
      if (e.action === 'create' && (e.record as unknown as NotificationRecord).user === user.id) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    return () => {
      pb.collection('notifications').unsubscribe('*')
    }
  }, [user])

  // Aluno Nav Items
  const alunoNav = [
    { label: 'Início', path: '/aluno', icon: Home },
    { label: 'Smartwatch', path: '/smartwatch', icon: Activity },
    { label: 'Monte Seu Treino', path: '/aluno/treino', icon: Dumbbell },
    { label: 'Encontrar Profissional', path: '/aluno/profissionais', icon: Users },
    { label: 'Conteúdos & E-books', path: '/conteudos', icon: Award },
    { label: 'Minha Carteira', path: '/aluno/carteira', icon: Wallet },
    { label: 'Comunidade', path: '/aluno/comunidade', icon: Trophy },
    { label: 'Chat', path: '/aluno/chat', icon: MessageSquare },
    { label: 'Perfil', path: '/aluno/perfil', icon: User },
  ]

  // Profissional Nav Items
  const profissionalNav = [
    { label: 'BackOffice', path: '/profissional', icon: Home },
    { label: 'Smartwatch', path: '/smartwatch', icon: Activity },
    { label: 'Alunos', path: '/profissional/alunos', icon: Users },
    { label: 'Conteúdos & Materiais', path: '/profissional/conteudos', icon: Award },
    { label: 'Agenda & Serviços', path: '/profissional/agenda', icon: Activity },
    { label: 'Financeiro & Carteira', path: '/profissional/carteira', icon: Wallet },
    { label: 'Perfil / Branding', path: '/profissional/perfil', icon: User },
  ]

  // Admin Nav Items
  const adminNav = [
    { label: 'Dashboard', path: '/admin', icon: Home },
    { label: 'Usuários', path: '/admin/usuarios', icon: Users },
    { label: 'Aprovações', path: '/admin/aprovacoes', icon: FileCheck2 },
    { label: 'Documentos Legais', path: '/admin/documentos-legais', icon: FileText },
    { label: 'Ranking & Cashback', path: '/admin/ranking', icon: Sliders },
    { label: 'Auditoria', path: '/admin/auditoria', icon: ShieldCheck },
  ]
  const currentNav =
    user?.role === 'admin' ? adminNav : user?.role === 'profissional' ? profissionalNav : alunoNav

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1A1A] flex flex-col selection:bg-[#D4AF37] selection:text-black">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E5E3DC] bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        {/* Brand Left Lockup */}
        <Link
          to={
            user?.role === 'admin'
              ? '/admin'
              : user?.role === 'profissional'
                ? '/profissional'
                : '/aluno'
          }
          className="flex items-center gap-3 group"
        >
          <CrestLogo size={42} showText subText />
        </Link>

        {/* Desktop Role-Specific Primary Nav */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {currentNav.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-xl text-xs font-bold font-montserrat uppercase flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-[#FAFAF7] text-[#B8962E] border border-[#D4AF37]/50 shadow-xs'
                    : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-black/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right Section: Plan Badge + Notif Bell + Avatar Menu */}
        <div className="flex items-center gap-3">
          {/* Plan Tier Badge for Professionals */}
          {user?.role === 'profissional' && (
            <span
              className={`hidden sm:inline-flex items-center text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full font-montserrat border ${
                user?.plan === 'premium'
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                  : user?.plan === 'pro'
                    ? 'bg-[#0057FF]/15 text-[#0057FF] border-[#0057FF]/40'
                    : 'bg-gray-800 text-gray-300 border-gray-700'
              }`}
            >
              Plano {user?.plan?.toUpperCase() || 'BASICO'}
            </span>
          )}

          {/* Real-time Notification Bell */}
          <Link
            to={user?.role === 'profissional' ? '/profissional/agenda' : '/aluno'}
            className="relative p-2 rounded-xl bg-[#FAFAF7] border border-[#E5E3DC] text-gray-700 hover:text-[#B8962E] hover:border-[#D4AF37] transition-all"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 !text-white font-bold text-[9px] flex items-center justify-center font-mono animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* User Avatar Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl bg-[#FAFAF7] border border-[#E5E3DC] hover:border-[#D4AF37] transition-all"
            >
              <img
                src="https://img.usecurling.com/ppl/medium?gender=male&seed=1"
                alt="Avatar"
                className="w-7 h-7 rounded-lg object-cover border border-[#D4AF37]"
              />
              <span className="hidden md:inline-block text-xs font-bold font-montserrat text-[#1A1A1A] max-w-[120px] truncate">
                {user?.name?.split(' ')[0] || 'Usuário'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-[#E5E3DC] p-1.5 shadow-xl z-50 animate-fade-in font-inter text-xs"
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-[#E5E3DC] mb-1">
                  <p className="font-bold text-[#1A1A1A] font-montserrat truncate">{user?.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                </div>
                <Link
                  to={user?.role === 'profissional' ? '/profissional/carteira' : '/aluno/carteira'}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:text-[#1A1A1A] hover:bg-black/5"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#B8962E]" /> Minha Carteira
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-left font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sair da Conta
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#FAFAF7] border border-[#E5E3DC] text-gray-700 hover:text-black"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[65px] bg-white/95 backdrop-blur-xl border-b border-[#E5E3DC] z-40 p-4 space-y-2 animate-fade-in shadow-lg">
          {currentNav.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full px-4 py-3 rounded-xl text-xs font-bold font-montserrat uppercase flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-[#FAFAF7] text-[#B8962E] border border-[#D4AF37]/50'
                    : 'text-gray-700 hover:bg-black/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}

          <div className="pt-2 border-t border-[#E5E3DC]">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Sair
            </Button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 pt-6 pb-20 sm:pb-8">
        {children}
      </main>

      {/* BOTTOM TAB BAR (Aluno Mobile Only: Home | Comunidade | Chat | Perfil) */}
      {user?.role === 'aluno' && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#E5E3DC] px-2 py-2 flex items-center justify-around shadow-lg">
          <Link
            to="/aluno"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold font-montserrat uppercase ${
              location.pathname === '/aluno' ? 'text-[#B8962E]' : 'text-gray-500'
            }`}
          >
            <Home className="w-5 h-5" /> Início
          </Link>
          <Link
            to="/aluno/comunidade"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold font-montserrat uppercase ${
              location.pathname === '/aluno/comunidade' ? 'text-[#B8962E]' : 'text-gray-500'
            }`}
          >
            <Trophy className="w-5 h-5" /> Comunidade
          </Link>
          <Link
            to="/aluno/chat"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold font-montserrat uppercase ${
              location.pathname === '/aluno/chat' ? 'text-[#B8962E]' : 'text-gray-500'
            }`}
          >
            <MessageSquare className="w-5 h-5" /> Chat
          </Link>
          <Link
            to="/aluno/perfil"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold font-montserrat uppercase ${
              location.pathname === '/aluno/perfil' ? 'text-[#B8962E]' : 'text-gray-500'
            }`}
          >
            <User className="w-5 h-5" /> Perfil
          </Link>
        </nav>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#E5E3DC] bg-[#F7F5F0] py-6 px-6 text-center text-xs text-gray-600 font-inter">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} 369 TRAINING — FOCO • LEGADO • ESTRATÉGIA</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
            <Link to="/termos-de-uso" className="hover:text-[#B8962E] transition-colors">
              Termos do Aluno
            </Link>
            <span>•</span>
            <Link to="/contrato-parceria" className="hover:text-[#B8962E] transition-colors">
              Contrato de Parceria
            </Link>
            <span>•</span>
            <Link to="/regulamento-cashback" className="hover:text-[#B8962E] transition-colors">
              Regulamento Cashback
            </Link>
            <span>•</span>
            <Link to="/politica-de-privacidade" className="hover:text-[#B8962E] transition-colors">
              Política de Privacidade
            </Link>
            <span>•</span>
            <Link to="/lgpd-consentimentos" className="hover:text-[#B8962E] transition-colors">
              LGPD & Consentimentos
            </Link>
          </div>
          <p className="italic text-[11px] text-gray-500">
            &ldquo;Se você soubesse a magnificência dos números 3, 6 e 9...&rdquo; — Nikola Tesla
          </p>
        </div>
      </footer>
    </div>
  )
}
