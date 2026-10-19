import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import SupabaseAccount from './pages/SupabaseAccount'
import './main.css'
createRoot(document.getElementById('root')!).render(<BrowserRouter><header className="border-b bg-lime-200 p-4 text-slate-900"><a href="/evolucao.html" className="font-semibold">← 369 WELLNESS · Voltar à central</a><p className="mt-2 text-sm">Acesso real ao Supabase. Cadastros e alterações feitas nesta área são persistentes. O perfil inicial é de aluno; o acesso administrativo exige autorização.</p></header><SupabaseAccount redirectPath="/acesso.html"/></BrowserRouter>)
