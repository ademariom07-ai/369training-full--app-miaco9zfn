import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { RoleGuard } from '@/components/RoleGuard'
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/sonner'
import ErrorBoundary from '@/components/ErrorBoundary'

// Public Pages
import Index from '@/pages/Index'
import Login from '@/pages/Login'
import Cadastro from '@/pages/Cadastro'
import TermosDeUso from '@/pages/TermosDeUso'
import PoliticaDePrivacidade from '@/pages/PoliticaDePrivacidade'
import LgpdConsentimentos from '@/pages/LgpdConsentimentos'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import NotFound from '@/pages/NotFound'

// Aluno Pages
import AlunoHome from '@/pages/aluno/AlunoHome'
import AlunoCarteira from '@/pages/aluno/AlunoCarteira'
import MonteSeuTreino from '@/pages/aluno/MonteSeuTreino'
import EncontrarProfissional from '@/pages/aluno/EncontrarProfissional'
import Nutricao from '@/pages/aluno/Nutricao'
import Fisioterapia from '@/pages/aluno/Fisioterapia'
import ArtesMarciais from '@/pages/aluno/ArtesMarciais'
import Comunidade from '@/pages/aluno/Comunidade'
import ChatScreen from '@/pages/aluno/ChatScreen'
import AlunoPerfil from '@/pages/aluno/AlunoPerfil'
import ConteudosEmDestaque from '@/pages/aluno/ConteudosEmDestaque'

// Profissional Pages
import ProfissionalDashboard from '@/pages/profissional/ProfissionalDashboard'
import GestaoAlunos from '@/pages/profissional/GestaoAlunos'
import ProfissionalChatScreen from '@/pages/profissional/ProfissionalChatScreen'
import ProfissionalConteudos from '@/pages/profissional/ProfissionalConteudos'
import CriacaoTreino from '@/pages/profissional/CriacaoTreino'
import CriacaoDieta from '@/pages/profissional/CriacaoDieta'
import AgendaServicos from '@/pages/profissional/AgendaServicos'
import ProfissionalCarteira from '@/pages/profissional/ProfissionalCarteira'
import ProfissionalPerfil from '@/pages/profissional/ProfissionalPerfil'
import ExpertChatPage from '@/pages/profissional/ExpertChatPage'

// Admin Pages
import AdminDashboard from '@/pages/admin/AdminDashboard'
import GestaoUsuarios from '@/pages/admin/GestaoUsuarios'
import AprovacoesProfissionais from '@/pages/admin/AprovacoesProfissionais'
import AdminRankingConfig from '@/pages/admin/AdminRankingConfig'
import AdminAuditoria from '@/pages/admin/AdminAuditoria'
import AdminDocumentosLegais from '@/pages/admin/AdminDocumentosLegais'
import LegalDocViewer from '@/pages/LegalDocViewer'
import ReacceptanceModal from '@/components/ReacceptanceModal'
import SmartwatchPage from '@/pages/SmartwatchPage'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Landing & Auth & Legal */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route
              path="/conteudos"
              element={
                <Layout>
                  <ConteudosEmDestaque />
                </Layout>
              }
            />
            <Route path="/termos-de-uso" element={<LegalDocViewer slugOverride="termos-aluno" />} />
            <Route
              path="/politica-de-privacidade"
              element={<LegalDocViewer slugOverride="politica-privacidade" />}
            />
            <Route
              path="/lgpd-consentimentos"
              element={<LegalDocViewer slugOverride="lgpd-consentimentos" />}
            />
            <Route
              path="/contrato-parceria"
              element={<LegalDocViewer slugOverride="contrato-parceria-profissional" />}
            />
            <Route
              path="/regulamento-cashback"
              element={<LegalDocViewer slugOverride="regulamento-cashback" />}
            />
            <Route
              path="/politica-reembolso"
              element={<LegalDocViewer slugOverride="politica-reembolso" />}
            />
            <Route path="/documento/:slug" element={<LegalDocViewer />} />

            {/* Smartwatch Routes (Aluno & Profissional) */}
            <Route
              path="/smartwatch"
              element={
                <RoleGuard allowedRoles={['aluno', 'profissional', 'admin']}>
                  <Layout>
                    <SmartwatchPage />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/smartwatch"
              element={
                <RoleGuard allowedRoles={['aluno', 'profissional', 'admin']}>
                  <Layout>
                    <SmartwatchPage />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/smartwatch"
              element={
                <RoleGuard allowedRoles={['aluno', 'profissional', 'admin']}>
                  <Layout>
                    <SmartwatchPage />
                  </Layout>
                </RoleGuard>
              }
            />

            {/* Aluno Routes */}
            <Route
              path="/aluno"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <AlunoHome />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/carteira"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <AlunoCarteira />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/treino"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <MonteSeuTreino />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/profissionais"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <EncontrarProfissional />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/conteudos"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <ConteudosEmDestaque />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/nutricao"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <Nutricao />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/fisioterapia"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <Fisioterapia />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/artes-marciais"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <ArtesMarciais />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/comunidade"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <Comunidade />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/chat"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <ChatScreen />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/chat/:profId"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <ChatScreen />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/aluno/perfil"
              element={
                <RoleGuard allowedRoles={['aluno']}>
                  <Layout>
                    <AlunoPerfil />
                  </Layout>
                </RoleGuard>
              }
            />

            {/* Profissional Routes */}
            <Route
              path="/profissional"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalDashboard />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/dashboard"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalDashboard />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/alunos"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <GestaoAlunos />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/chat"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalChatScreen />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/chat/:alunoId"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalChatScreen />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/conteudos"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalConteudos />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/treinos/novo"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <CriacaoTreino />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/dietas/nova"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <CriacaoDieta />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/agenda"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <AgendaServicos />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/carteira"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalCarteira />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/perfil"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ProfissionalPerfil />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/profissional/experts/:slug"
              element={
                <RoleGuard allowedRoles={['profissional']}>
                  <Layout>
                    <ExpertChatPage />
                  </Layout>
                </RoleGuard>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <GestaoUsuarios />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/admin/aprovacoes"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <AprovacoesProfissionais />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/admin/ranking"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <AdminRankingConfig />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/admin/auditoria"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <AdminAuditoria />
                  </Layout>
                </RoleGuard>
              }
            />
            <Route
              path="/admin/documentos-legais"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Layout>
                    <AdminDocumentosLegais />
                  </Layout>
                </RoleGuard>
              }
            />

            {/* 404 & Fallbacks */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsentBanner />
          <ReacceptanceModal />
          <Toaster richColors position="top-right" />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}
