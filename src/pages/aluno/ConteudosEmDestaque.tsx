import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sparkles,
  Search,
  Filter,
  Video,
  FileText,
  BookOpen,
  Table,
  ExternalLink,
  Download,
  CheckCircle2,
  Lock,
  Loader2,
  User,
  Play,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { ContentItem } from '@/pages/profissional/ProfissionalConteudos'

interface ContentWithProf extends ContentItem {
  expand?: {
    professional_id?: {
      id: string
      name: string
      avatar?: string
      plan?: string
      rating_avg?: number
    }
  }
}

export default function ConteudosEmDestaque() {
  const [contents, setContents] = useState<ContentWithProf[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeVideoModal, setActiveVideoModal] = useState<ContentWithProf | null>(null)

  useEffect(() => {
    pb.collection('contents')
      .getList<ContentWithProf>(1, 100, {
        filter: 'status = "aprovado"',
        sort: '-created',
        expand: 'professional_id',
      })
      .then((res) => {
        setContents(res.items)
      })
      .catch(() => {
        setContents([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredContents = contents.filter((item) => {
    const matchType = selectedType === 'todos' || item.type === selectedType
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.expand?.professional_id?.name &&
        item.expand.professional_id.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchType && matchSearch
  })

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'video':
        return <Video className="w-4 h-4 text-[#D4AF37]" />
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-400" />
      case 'ebook':
        return <BookOpen className="w-4 h-4 text-[#0057FF]" />
      case 'planilha':
        return <Table className="w-4 h-4 text-[#22C55E]" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeLabel = (t: string) => {
    switch (t) {
      case 'video':
        return 'Vídeo Aula'
      case 'pdf':
        return 'Guia PDF'
      case 'ebook':
        return 'E-book'
      case 'planilha':
        return 'Planilha'
      default:
        return 'Material'
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Biblioteca Pública de Conhecimento 369
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Conteúdos, E-books & Planilhas em Destaque
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1">
            Explore materiais técnicos, protocolos de treino, guias nutricionais e calculadoras
            desenvolvidas pelos especialistas 369.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="bg-[#181818] border border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          {/* Search */}
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, assunto ou especialista..."
              className="pl-10 bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
            />
          </div>

          {/* Type Select */}
          <div className="sm:col-span-4">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs font-semibold focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
            >
              <option value="todos">Todos os Formatos</option>
              <option value="video">Aulas em Vídeo</option>
              <option value="pdf">Documentos PDF</option>
              <option value="ebook">E-books</option>
              <option value="planilha">Planilhas & Calculadoras</option>
            </select>
          </div>
        </div>

        {/* Quick format pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#2A2A2A]">
          {['todos', 'pdf', 'ebook', 'planilha', 'video'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold font-montserrat uppercase transition-all ${
                selectedType === t
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
              }`}
            >
              {t === 'todos' ? 'Todos' : getTypeLabel(t)}
            </button>
          ))}
        </div>
      </Card>

      {/* Grid de Cards */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <span className="text-xs uppercase font-montserrat font-bold">
            Carregando conteúdos da rede...
          </span>
        </div>
      ) : filteredContents.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl space-y-3">
          <Filter className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold font-montserrat text-white">
            Nenhum conteúdo encontrado com os filtros selecionados
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-inter">
            Tente buscar com outro termo ou selecionar a opção &ldquo;Todos os Formatos&rdquo;.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContents.map((item) => {
            const prof = item.expand?.professional_id
            const isFree = !item.price || item.price === 0
            const hasFile = !!item.file
            const downloadUrl = hasFile ? pb.files.getURL(item, item.file) : item.file_url

            return (
              <Card
                key={item.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/60 p-5 rounded-2xl flex flex-col justify-between space-y-4 group transition-all hover:shadow-[0_8px_30px_rgba(212,175,55,0.08)]"
              >
                <div className="space-y-3">
                  {/* Top: Type Badge & Price Tag */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#2A2A2A] text-[11px] font-bold text-gray-300 uppercase font-montserrat">
                      {getTypeIcon(item.type)}
                      <span>{getTypeLabel(item.type)}</span>
                    </span>

                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
                        isFree
                          ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                          : 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                      }`}
                    >
                      {isFree ? 'Gratuito' : `R$ ${item.price.toFixed(2)}`}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold font-montserrat text-white group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-inter line-clamp-2 mt-1 leading-relaxed">
                      {item.description ||
                        'Material didático oficial para aprimoramento físico e nutricional.'}
                    </p>
                  </div>

                  {/* Author / Professional Info */}
                  <div className="flex items-center gap-2.5 pt-2 border-t border-[#2A2A2A]">
                    <div className="w-7 h-7 rounded-full bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                      {prof?.name?.[0] || 'P'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold font-montserrat text-white truncate">
                        {prof?.name || 'Especialista 369'}
                      </p>
                      <p className="text-[10px] text-gray-500 font-inter">
                        Plano {(prof?.plan || 'PRO').toUpperCase()} • Autor
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-3 border-t border-[#2A2A2A]">
                  {item.type === 'video' ? (
                    <Button
                      onClick={() => setActiveVideoModal(item)}
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      Assistir Aula
                    </Button>
                  ) : isFree ? (
                    <a
                      href={downloadUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 bg-[#22C55E] text-black hover:bg-[#1eb354] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Material (Grátis)
                    </a>
                  ) : (
                    <Button
                      onClick={() =>
                        toast.info(
                          `Módulo de Marketplace / Pagamento direto: Conteúdo premium no valor de R$ ${item.price.toFixed(2)}. Em breve!`,
                        )
                      }
                      className="w-full bg-[#0057FF] text-white hover:bg-[#1F6CFF] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Adquirir (R$ {item.price.toFixed(2)})
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL PARA REPRODUÇÃO DE VÍDEO */}
      <Dialog open={!!activeVideoModal} onOpenChange={() => setActiveVideoModal(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-2xl rounded-2xl p-6">
          {activeVideoModal && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs font-bold text-[#D4AF37] uppercase font-montserrat w-fit">
                  <Video className="w-3.5 h-3.5" />
                  Aula / Vídeo Oficial
                </div>
                <DialogTitle className="text-lg font-bold font-montserrat text-white mt-1">
                  {activeVideoModal.title}
                </DialogTitle>
              </DialogHeader>

              {activeVideoModal.file_url && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#2A2A2A]">
                  <iframe
                    src={
                      activeVideoModal.file_url.includes('youtube.com/watch?v=')
                        ? activeVideoModal.file_url.replace('watch?v=', 'embed/')
                        : activeVideoModal.file_url.includes('youtu.be/')
                          ? activeVideoModal.file_url.replace('youtu.be/', 'www.youtube.com/embed/')
                          : activeVideoModal.file_url
                    }
                    className="w-full h-full"
                    title={activeVideoModal.title}
                    allowFullScreen
                  />
                </div>
              )}

              {activeVideoModal.description && (
                <p className="text-xs text-gray-300 font-inter leading-relaxed bg-[#181818] p-3 rounded-xl border border-[#2A2A2A]">
                  {activeVideoModal.description}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
