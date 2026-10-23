# Mapa da consolidação operacional — 369 WELLNESS

Entrada publicada: acesso.html → src/access-main.tsx → SupabaseAccount. Branch prep/supabase-vite.

O build específico usa envDir:false e publicDir:false; bloqueia módulos PocketBase no grafo de dependências. Teste negativo com importação de pocketbase reprovou corretamente; build restaurado passou (115 módulos). Isso prova isolamento do bundle, não migração de dados históricos.

## Fonte por módulo

| Módulo | Caminho operacional | Pendência |
|---|---|---|
| Identidade | Supabase Auth + profiles | Homologar recuperação/logout em navegador |
| Vínculos/treinos | student_professional_links, training_plans, training_completions | Homologar fluxo completo com consentimento |
| Agenda | professional_availability_days, professional_booking_terms | Reservas e pagamento integrados |
| Administrativo | SupabaseAccount e componentes Admin* | Homologar todas as RPCs |
| Pontos/cashback | Simulações locais + rascunhos Supabase | Fonte de serviços/tarifas verificada e fechamento |
| Financeiro | Fundações wallet_* | Sem provedor nem conciliação real |
| Conteúdo/chat/áreas clínicas | Código legado | Portar após escopo e permissões definidos |

## Importações diretas remanescentes do cliente PocketBase

- `src/components/Agente369Section.tsx`
- `src/components/AlunoProfissionaisFeed.tsx`
- `src/components/ChatTermsModal.tsx`
- `src/components/ClinicalAreaGuard.tsx`
- `src/components/DesafiosAlunoSection.tsx`
- `src/components/GestaoDesafiosProfissional.tsx`
- `src/components/GestaoSessoesColetivas.tsx`
- `src/components/Layout.tsx`
- `src/components/MinhasAulasColetivasAluno.tsx`
- `src/components/PendingSubscriptions.tsx`
- `src/components/PlanChangeSection.tsx`
- `src/components/Radar369Section.tsx`
- `src/components/ReacceptanceModal.tsx`
- `src/components/RegisteredFeeSource.tsx`
- `src/components/ReviewModal.tsx`
- `src/components/SensitiveDataConsentModal.tsx`
- `src/components/SmartwatchDashboard.tsx`
- `src/components/StandardWalletPage.tsx`
- `src/components/admin/ExerciseVideoAgentStatus.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/use-realtime.ts`
- `src/lib/exerciseVideoSearch.ts`
- `src/pages/Cadastro.tsx`
- `src/pages/LegalDocViewer.tsx`
- `src/pages/LgpdConsentimentos.tsx`
- `src/pages/admin/AdminAuditoria.tsx`
- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/AdminDocumentosLegais.tsx`
- `src/pages/admin/AdminRankingConfig.tsx`
- `src/pages/admin/AprovacoesProfissionais.tsx`
- `src/pages/admin/GestaoUsuarios.tsx`
- `src/pages/aluno/AlunoHome.tsx`
- `src/pages/aluno/AlunoPerfil.tsx`
- `src/pages/aluno/ArtesMarciais.tsx`
- `src/pages/aluno/ChatScreen.tsx`
- `src/pages/aluno/Comunidade.tsx`
- `src/pages/aluno/ConteudosEmDestaque.tsx`
- `src/pages/aluno/EncontrarProfissional.tsx`
- `src/pages/aluno/Fisioterapia.tsx`
- `src/pages/aluno/MeuHistorico.tsx`
- `src/pages/aluno/MonteSeuTreino.tsx`
- `src/pages/aluno/Nutricao.tsx`
- `src/pages/profissional/AgendaServicos.tsx`
- `src/pages/profissional/CriacaoDieta.tsx`
- `src/pages/profissional/CriacaoTreino.tsx`
- `src/pages/profissional/GestaoAlunos.tsx`
- `src/pages/profissional/ProfissionalChatScreen.tsx`
- `src/pages/profissional/ProfissionalConteudos.tsx`
- `src/pages/profissional/ProfissionalDashboard.tsx`
- `src/pages/profissional/ProfissionalPerfil.tsx`
- `src/services/api.ts`

Estes arquivos são legado; não compõem a entrada de acesso Supabase validada. Não desativamos nem migramos uma instalação PocketBase externa nesta entrega.

## Verificação

39 testes de sessão, recuperação e vínculos passaram; TypeScript passou; build passou e teste negativo da barreira passou. Os testes não substituem login real e homologação dos três perfis no navegador.

Pacotes 0–15: correspondência aos arquivos originais ainda pendente; não certificados.
