import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { pb } from '@/lib/pocketbase/client'
import { LegalDocumentRecord } from '@/services/api'
import { CrestLogo } from '@/components/CrestLogo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  ArrowLeft,
  Calendar,
  Layers,
  Users,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

interface LegalDocViewerProps {
  slugOverride?: string
}

export function LegalDocViewer({ slugOverride }: LegalDocViewerProps) {
  const location = useLocation()

  // Mapear a rota atual para o slug padrão caso não seja fornecido via prop
  const getSlugFromPath = (): string => {
    if (slugOverride) return slugOverride
    const path = location.pathname.replace(/^\//, '').toLowerCase()
    switch (path) {
      case 'termos-de-uso':
        return 'termos-aluno'
      case 'politica-de-privacidade':
        return 'politica-privacidade'
      case 'lgpd-consentimentos':
        return 'lgpd-consentimentos'
      case 'contrato-parceria':
        return 'contrato-parceria-profissional'
      case 'regulamento-cashback':
        return 'regulamento-cashback'
      case 'politica-reembolso':
        return 'politica-reembolso'
      default:
        return path || 'termos-aluno'
    }
  }

  const slug = getSlugFromPath()
  const [doc, setDoc] = useState<LegalDocumentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function loadDoc() {
      setLoading(true)
      setError(null)
      try {
        // Tenta buscar documento por slug publicado
        const record = await pb
          .collection('legal_documents')
          .getFirstListItem<LegalDocumentRecord>(`slug = '${slug}' && status = 'publicado'`)
        if (isMounted) {
          setDoc(record)
        }
      } catch (err: any) {
        console.warn(`Documento legal não encontrado para o slug '${slug}':`, err)
        // Fallback: se não achar pelo status publicado direto, tenta pegar o slug
        try {
          const fallbackRec = await pb
            .collection('legal_documents')
            .getFirstListItem<LegalDocumentRecord>(`slug = '${slug}'`)
          if (isMounted) setDoc(fallbackRec)
        } catch {
          if (isMounted) {
            setError(
              'O documento solicitado não está disponível ou ainda não foi publicado pelo administrador.',
            )
          }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDoc()
    return () => {
      isMounted = false
    }
  }, [slug])

  // Renderizador simples de Markdown com formatação semântica
  const renderMarkdownBody = (markdownText: string) => {
    if (!markdownText) return null

    // Quebra por linhas e gera elementos limpos
    const lines = markdownText.split('\n')
    const elements: React.ReactNode[] = []
    let currentParagraph: string[] = []

    const flushParagraph = (key: number) => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ')
        elements.push(
          <p key={`p-${key}`} className="text-sm text-gray-300 leading-relaxed my-3">
            {formatInlineText(text)}
          </p>,
        )
        currentParagraph = []
      }
    }

    const formatInlineText = (text: string) => {
      // Substitui negrito **texto**
      const parts = text.split(/(\*\*.*?\*\*)/g)
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-white font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return part
      })
    }

    let insideBlockquote = false
    let blockquoteLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('>')) {
        flushParagraph(i)
        insideBlockquote = true
        blockquoteLines.push(line.replace(/^>\s?/, ''))
        continue
      } else if (insideBlockquote) {
        elements.push(
          <div
            key={`bq-${i}`}
            className="my-4 p-4 rounded-xl bg-[#D4AF37]/10 border-l-4 border-[#D4AF37] text-gray-200 text-xs sm:text-sm space-y-1"
          >
            {blockquoteLines.map((bql, bqi) => (
              <p key={bqi}>{formatInlineText(bql)}</p>
            ))}
          </div>,
        )
        blockquoteLines = []
        insideBlockquote = false
      }

      if (line.startsWith('### ')) {
        flushParagraph(i)
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-base font-bold font-montserrat text-white uppercase mt-6 mb-2 flex items-center gap-2"
          >
            {line.replace('### ', '')}
          </h3>,
        )
      } else if (line.startsWith('## ')) {
        flushParagraph(i)
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-lg sm:text-xl font-bold font-montserrat text-white uppercase mt-8 mb-3 flex items-center gap-2"
          >
            <span className="text-[#D4AF37]">§</span> {line.replace('## ', '')}
          </h2>,
        )
      } else if (line.startsWith('# ')) {
        flushParagraph(i)
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-2xl font-black font-montserrat text-white uppercase mt-4 mb-4"
          >
            {line.replace('# ', '')}
          </h1>,
        )
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        flushParagraph(i)
        elements.push(
          <li key={`li-${i}`} className="ml-5 list-disc text-sm text-gray-300 my-1">
            {formatInlineText(line.replace(/^[-*]\s+/, ''))}
          </li>,
        )
      } else if (line === '') {
        flushParagraph(i)
      } else {
        currentParagraph.push(line)
      }
    }

    flushParagraph(lines.length)
    if (blockquoteLines.length > 0) {
      elements.push(
        <div
          key="bq-last"
          className="my-4 p-4 rounded-xl bg-[#D4AF37]/10 border-l-4 border-[#D4AF37] text-gray-200 text-xs sm:text-sm space-y-1"
        >
          {blockquoteLines.map((bql, bqi) => (
            <p key={bqi}>{formatInlineText(bql)}</p>
          ))}
        </div>,
      )
    }

    return elements
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black font-inter">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <CrestLogo size={40} showText subText />
          </Link>
          <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className="bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-montserrat uppercase">
            <FileText className="w-3.5 h-3.5 mr-1" /> Documento Oficial 369
          </Badge>
          {doc && (
            <>
              <Badge variant="outline" className="border-[#2A2A2A] text-gray-300 text-xs">
                <Layers className="w-3 h-3 mr-1 text-[#D4AF37]" /> Versão {doc.version}.0
              </Badge>
              <Badge
                variant="outline"
                className="border-[#2A2A2A] text-gray-300 text-xs capitalize"
              >
                <Users className="w-3 h-3 mr-1 text-[#D4AF37]" /> Público: {doc.audience}
              </Badge>
            </>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl font-black font-montserrat text-white uppercase tracking-tight">
          {loading ? 'Carregando documento...' : doc?.title || 'Documento Legal'}
        </h1>

        {doc?.published_at && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
            Última publicação:{' '}
            {new Date(doc.published_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        <Card className="bg-[#141414] border border-[#2A2A2A] p-6 sm:p-10 rounded-2xl text-gray-300 leading-relaxed shadow-xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
              <p className="text-xs">Carregando termos atualizados...</p>
            </div>
          ) : error || !doc ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#EF4444] mx-auto" />
              <h3 className="text-base font-bold text-white uppercase font-montserrat">
                Documento Não Encontrado
              </h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">{error}</p>
              <Link to="/">
                <Button size="sm" className="mt-4 bg-[#D4AF37] text-black hover:bg-[#e0be4a]">
                  Ir para a página inicial
                </Button>
              </Link>
            </div>
          ) : (
            <div className="legal-doc-content">{renderMarkdownBody(doc.body)}</div>
          )}

          {/* Links Rápidos no Rodapé do Card */}
          <div className="pt-8 mt-10 border-t border-[#2A2A2A] flex flex-wrap gap-2 text-xs">
            <span className="text-gray-400 font-semibold self-center mr-2">Outros documentos:</span>
            <Link to="/termos-de-uso">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                Termos do Aluno
              </Button>
            </Link>
            <Link to="/contrato-parceria">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                Contrato do Profissional
              </Button>
            </Link>
            <Link to="/regulamento-cashback">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                Regulamento do Cashback
              </Button>
            </Link>
            <Link to="/politica-de-privacidade">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                Política de Privacidade
              </Button>
            </Link>
            <Link to="/lgpd-consentimentos">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                LGPD & Dados Sensíveis
              </Button>
            </Link>
            <Link to="/politica-reembolso">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] border-[#2A2A2A] text-gray-300 hover:text-white"
              >
                Política de Reembolso
              </Button>
            </Link>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] bg-[#070707] py-6 px-6 text-center text-xs text-gray-500 font-inter">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} 369TRAINING LTDA. CNPJ: 00.000.000/0001-00</p>
          <div className="flex gap-4 text-xs">
            <Link to="/politica-de-privacidade" className="text-gray-400 hover:text-[#D4AF37]">
              Privacidade
            </Link>
            <Link to="/termos-de-uso" className="text-gray-400 hover:text-[#D4AF37]">
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
export default LegalDocViewer
