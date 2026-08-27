import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FolderPlus,
  Video,
  FileText,
  BookOpen,
  Table,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ContentItem {
  id: string
  professional_id: string
  title: string
  description?: string
  type: 'video' | 'pdf' | 'ebook' | 'planilha'
  file?: string
  file_url?: string
  price: number
  status: 'pendente' | 'aprovado' | 'rejeitado'
  rejection_reason?: string
  created: string
  updated?: string
}

export default function ProfissionalConteudos() {
  const { user } = useAuth()
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'video' | 'pdf' | 'ebook' | 'planilha'>('pdf')
  const [fileUrl, setFileUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [price, setPrice] = useState('0')

  // Preview Modal
  const [previewContent, setPreviewContent] = useState<ContentItem | null>(null)

  const loadContents = async () => {
    if (!user) return
    try {
      const res = await pb.collection('contents').getList<ContentItem>(1, 100, {
        filter: `professional_id = "${user.id}"`,
        sort: '-created',
      })
      setContents(res.items)
    } catch {
      setContents([])
    }
  }

  useEffect(() => {
    loadContents().finally(() => setLoading(false))
  }, [user])

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!title.trim()) {
      toast.error('Informe o título do material.')
      return
    }

    if (type === 'video') {
      if (!fileUrl.trim()) {
        toast.error('Para vídeos, cole o link do YouTube ou Vimeo.')
        return
      }
    } else {
      if (!selectedFile && !fileUrl.trim()) {
        toast.error('Faça upload do arquivo (PDF, E-book ou Planilha) ou informe um link.')
        return
      }
    }

    setCreating(true)
    try {
      const formData = new FormData()
      formData.append('professional_id', user.id)
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('type', type)
      formData.append('price', (parseFloat(price) || 0).toString())
      formData.append('status', 'pendente') // Envia para aprovação

      if (type === 'video' || fileUrl.trim()) {
        formData.append('file_url', fileUrl.trim())
      }

      if (selectedFile) {
        // Max 20MB
        if (selectedFile.size > 20 * 1024 * 1024) {
          toast.error('O tamanho máximo permitido para arquivos é de 20MB.')
          setCreating(false)
          return
        }
        formData.append('file', selectedFile)
      }

      await pb.collection('contents').create(formData)
      toast.success('Conteúdo enviado com sucesso para aprovação do time 369!')
      setModalOpen(false)
      // Reset form
      setTitle('')
      setDescription('')
      setType('pdf')
      setFileUrl('')
      setSelectedFile(null)
      setPrice('0')
      loadContents()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao criar conteúdo.')
    } finally {
      setCreating(false)
    }
  }

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        )
      case 'rejeitado':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-950/40 border border-red-500/40 text-red-400">
            <XCircle className="w-3 h-3" /> Rejeitado
          </span>
        )
      case 'pendente':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/40 text-amber-400">
            <Clock className="w-3 h-3" /> Em Análise
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            Gestão da Evolução
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-montserrat text-white uppercase tracking-tight">
            Biblioteca da Evolução
          </h1>{' '}
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1">
            Publique PDFs, e-books, planilhas de cálculo e vídeos de aulas técnicas para seus alunos
            e comunidade.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase px-6 py-5 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Novo Conteúdo / Material
        </Button>
      </div>

      {/* Grid de Conteúdos Cadastrados */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <span className="text-xs uppercase font-montserrat font-bold">
            Carregando conteúdos...
          </span>
        </div>
      ) : contents.length === 0 ? (
        <Card className="bg-[#181818] border border-[#2A2A2A] p-12 text-center rounded-2xl space-y-3">
          <FolderPlus className="w-12 h-12 text-gray-500 mx-auto" />
          <h3 className="text-lg font-bold font-montserrat text-white">
            Nenhum conteúdo publicado ainda
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto font-inter">
            Você pode disponibilizar e-books, tabelas de periodização em planilha, guias
            nutricionais em PDF ou aulas em vídeo (YouTube/Vimeo).
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            variant="outline"
            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 text-xs font-bold uppercase mt-2 rounded-xl"
          >
            Adicionar Primeiro Conteúdo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {contents.map((item) => {
            const hasFile = !!item.file
            const hasUrl = !!item.file_url
            const downloadOrViewUrl = hasFile
              ? pb.files.getURL(item, item.file)
              : item.file_url || '#'

            return (
              <Card
                key={item.id}
                className="bg-[#181818] border border-[#2A2A2A] hover:border-[#D4AF37]/60 transition-all p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#2A2A2A] text-xs font-bold text-gray-300 uppercase font-montserrat">
                      {getTypeIcon(item.type)}
                      <span>{item.type}</span>
                    </div>

                    {getStatusBadge(item.status)}
                  </div>

                  <div>
                    <h3 className="text-base font-bold font-montserrat text-white group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-gray-400 font-inter line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {item.status === 'rejeitado' && item.rejection_reason && (
                    <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-[11px] text-red-300">
                      <strong>Motivo da reprovação:</strong> {item.rejection_reason}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#2A2A2A] flex items-center justify-between text-xs">
                  <div className="font-mono">
                    <span className="text-gray-400 text-[10px] block">Preço:</span>
                    <span className="font-bold text-white">
                      {item.price > 0 ? `R$ ${item.price.toFixed(2)}` : 'Gratuito'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewContent(item)}
                      className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs h-8 px-2.5 rounded-lg"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                    </Button>

                    {(hasFile || hasUrl) && (
                      <a
                        href={downloadOrViewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-[#D4AF37] hover:border-[#D4AF37] transition-colors"
                        title="Abrir arquivo ou link externo"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / UPLOAD */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-lg rounded-2xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold font-montserrat text-white uppercase flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#D4AF37]" /> Enviar Conteúdo para Aprovação
            </DialogTitle>
            <p className="text-xs text-gray-400 font-inter">
              Materiais passam pela auditoria técnica do 369TRAINING antes de serem listados
              publicamente.
            </p>
          </DialogHeader>

          <form onSubmit={handleCreateContent} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Título do Conteúdo *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Planilha de Periodização Linear 12 Semanas"
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Tipo de Formato *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                >
                  <option value="pdf">Documento PDF</option>
                  <option value="ebook">E-book (PDF / EPUB)</option>
                  <option value="planilha">Planilha (XLSX / CSV)</option>
                  <option value="video">Vídeo (YouTube / Vimeo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Preço em R$ (0 = Gratuito)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Upload de Arquivo ou Link de Vídeo */}
            {type === 'video' ? (
              <div>
                <label className="block text-xs font-semibold text-[#D4AF37] uppercase mb-1 font-montserrat">
                  Link do Vídeo (YouTube ou Vimeo) *
                </label>
                <Input
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... ou https://vimeo.com/..."
                  className="bg-[#181818] border-[#D4AF37]/40 rounded-xl text-xs text-white font-mono"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase font-montserrat">
                  Arquivo para Upload (Máx 20MB)
                </label>
                <Input
                  type="file"
                  accept=".pdf,.epub,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white cursor-pointer file:bg-[#D4AF37] file:text-black file:font-bold file:border-none file:rounded-lg file:mr-3 file:text-xs file:cursor-pointer"
                />
                <p className="text-[10px] text-gray-500">
                  Formatos aceitos: PDF, E-pub, planilhas Excel (.xlsx, .csv) e documentos Word.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Descrição e Instruções
              </label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique o objetivo do material, como aplicá-lo e o que o aluno irá aprender..."
                className="bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={creating}
                className="flex-1 bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase h-11 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar para Aprovação'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#2A2A2A] text-gray-400 text-xs rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO */}
      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-xl rounded-2xl p-6">
          {previewContent && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-xs font-bold text-gray-300 uppercase">
                    {getTypeIcon(previewContent.type)}
                    <span>{previewContent.type}</span>
                  </div>
                  {getStatusBadge(previewContent.status)}
                </div>
                <DialogTitle className="text-xl font-bold font-montserrat text-white mt-2">
                  {previewContent.title}
                </DialogTitle>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-[#181818] border border-[#2A2A2A] space-y-2 text-xs text-gray-300">
                <p className="font-inter leading-relaxed">
                  {previewContent.description || 'Sem descrição cadastrada.'}
                </p>
                <div className="pt-2 border-t border-[#2A2A2A] flex justify-between font-mono text-[11px] text-gray-400">
                  <span>
                    Preço:{' '}
                    {previewContent.price > 0
                      ? `R$ ${previewContent.price.toFixed(2)}`
                      : 'Gratuito'}
                  </span>
                  <span>Data: {new Date(previewContent.created).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {previewContent.type === 'video' && previewContent.file_url && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#2A2A2A]">
                  <iframe
                    src={
                      previewContent.file_url.includes('youtube.com/watch?v=')
                        ? previewContent.file_url.replace('watch?v=', 'embed/')
                        : previewContent.file_url.includes('youtu.be/')
                          ? previewContent.file_url.replace('youtu.be/', 'www.youtube.com/embed/')
                          : previewContent.file_url
                    }
                    className="w-full h-full"
                    title={previewContent.title}
                    allowFullScreen
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewContent(null)}
                  className="border-[#2A2A2A] text-xs text-white"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
