import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import SupabaseAccount from './pages/SupabaseAccount'
import './main.css'
import {setupPwa} from './lib/pwa'
setupPwa()
createRoot(document.getElementById('root')!).render(<BrowserRouter><header className="border-b bg-lime-200 p-4 text-slate-900"><a href="/" className="font-semibold">← 369 WELLNESS · Início</a><p className="mt-2 text-sm">Foco, disciplina e estratégia para o seu bem-estar.</p></header><SupabaseAccount redirectPath="/acesso.html"/></BrowserRouter>)
