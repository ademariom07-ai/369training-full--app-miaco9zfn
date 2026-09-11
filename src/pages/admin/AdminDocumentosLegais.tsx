import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { LegalDocumentRecord } from '@/services/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Plus,
  Edit3,
  Archive,
  History,
  CheckCircle2,
  ExternalLink,
  Save,
  Clock,
  Layers,
  Users,
  Search,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminDocumentosLegais() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<LegalDocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAudience, setFilterAudience] = useState<string>('todos')

  // Estado do Modal de Edição/Criação
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<LegalDocumentRecord | null>(null)
  const [formData, setFormData] = useState<{
    slug: string
    title: string
    body: string
    audience: 'aluno' | 'profissional' | 'todos'
    status: 'rascunho' | 'publicado' | 'arquivado'
    incrementVersion: boolean
  }>({
    slug: '',
    title: '',
    body: '',
    audience: 'todos',
    status: 'rascunho',
    incrementVersion: false,
  })

  // Estado do Modal de Histórico de Versões
  const [historyDoc, setHistoryDoc] = useState<LegalDocumentRecord | null>(null)
  const [previewHistoryItem, setPreviewHistoryItem] = useState<{
    version: number
    title: string
    body: string
    published_at: string
  } | null>(null)

  // Carregar documentos
  const fetchDocs = async () => {
    setLoading(true)
    try {
      const records = await pb.collection('legal_documents').getFullList<LegalDocumentRecord>({
        sort: '-updated',
      })
      setDocs(records)
    } catch (err: any) {
      console.error('Erro ao carregar legal_documents:', err)
      toast.error('Não foi possível carregar os documentos legais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  // Abertura do formulário de criação
  const handleOpenCreate = () => {
    setEditingDoc(null)
    setFormData({
      slug: '',
      title: '',
      body: '',
      audience: 'todos',
      status: 'publicado',
      incrementVersion: false,
    })
    setIsEditorOpen(true)
  }

  // Abertura do formulário de edição
  const handleOpenEdit = (doc: LegalDocumentRecord) => {
    setEditingDoc(doc)
    setFormData({
      slug: doc.slug,
      title: doc.title,
      body: doc.body || '',
      audience: doc.audience,
      status: doc.status,
      incrementVersion: false,
    })
    setIsEditorOpen(true)
  }

  // Salvar Documento (Criação ou Atualização com Versionamento)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.slug.trim() || !formData.title.trim() || !formData.body.trim()) {
      toast.error('Preencha o slug, o título e o corpo do documento.')
      return
    }

    try {
      const nowIso = new Date().toISOString()
      const nowIsoPb = nowIso.replace('T', ' ').slice(0, 19)

      if (editingDoc) {
        // Atualização de documento existente
        let newVersion = editingDoc.version || 1
        const shouldBump = formData.incrementVersion || formData.status === 'publicado'

        if (formData.incrementVersion) {
          newVersion += 1
        }

        // Histórico anterior
        const currentHistory = Array.isArray(editingDoc.version_history)
          ? [...editingDoc.version_history]
          : []

        // Guardar versão anterior no histórico se incrementou a versão
        if (formData.incrementVersion) {
          currentHistory.push({
            version: editingDoc.version,
            title: editingDoc.title,
            body: editingDoc.body,
            published_at: editingDoc.published_at || editingDoc.updated,
            published_by: user?.id || 'admin',
          })
        }

        await pb.collection('legal_documents').update(editingDoc.id, {
          title: formData.title,
          slug: formData.slug.toLowerCase().trim(),
          body: formData.body,
          audience: formData.audience,
          status: formData.status,
          version: newVersion,
          published_at: formData.status === 'publicado' ? nowIsoPb : editingDoc.published_at,
          updated_by: user?.id,
          version_history: currentHistory,
        })

        toast.success(
          formData.incrementVersion
            ? `Documento atualizado para a versão ${newVersion}.0! Notificações de re-aceite serão disparadas aos usuários.`
            : 'Documento atualizado com sucesso.',
        )
      } else {
        // Novo documento
        await pb.collection('legal_documents').create({
          title: formData.title,
          slug: formData.slug.toLowerCase().trim(),
          body: formData.body,
          audience: formData.audience,
          status: formData.status,
          version: 1,
          published_at: formData.status === 'publicado' ? nowIsoPb : null,
          updated_by: user?.id,
          version_history: [
            {
              version: 1,
              title: formData.title,
              body: formData.body,
              published_at: nowIsoPb,
              published_by: user?.id,
            },
          ],
        })
        toast.success('Novo documento legal publicado com sucesso!')
      }

      setIsEditorOpen(false)
      fetchDocs()
    } catch (err: any) {
      console.error('Erro ao salvar documento legal:', err)
      toast.error(`Erro ao salvar: ${err.message || 'Verifique se o slug já existe.'}`)
    }
  }

  // Filtragem
  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.slug.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAudience = filterAudience === 'todos' || d.audience === filterAudience
    return matchesSearch && matchesAudience
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-xs font-bold text-[#D4AF37] uppercase font-montserrat mb-2">
            <FileText className="w-3.5 h-3.5" />
            Governança & Jurídico (Tarefa 1)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-montserrat text-white uppercase tracking-tight">
            Gestão de Documentos Legais
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Crie, versione e publique termos, contratos e políticas. Mudanças de versão exigem
            re-aceite obrigatório dos usuários no login.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#D4AF37] text-black hover:bg-[#e0be4a] font-montserrat uppercase font-bold text-xs shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Novo Documento
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="bg-[#141414] border border-[#2A2A2A] p-4 rounded-xl flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título ou slug..."
            className="pl-9 bg-[#181818] border-[#2A2A2A] text-white text-xs h-10"
          />
        </div>
        <div className="flex items-center gap-2 sm:w-56 shrink-0">
          <Users className="w-4 h-4 text-gray-400" />
          <Select value={filterAudience} onValueChange={setFilterAudience}>
            <SelectTrigger className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-10">
              <SelectValue placeholder="Público-alvo" />
            </SelectTrigger>
            <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
              <SelectItem value="todos">Todos os Públicos</SelectItem>
              <SelectItem value="aluno">Alunos / Clientes</SelectItem>
              <SelectItem value="profissional">Profissionais</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista de Documentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs">
            Carregando documentos legais...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs">
            Nenhum documento legal encontrado para os filtros selecionados.
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const historyCount = Array.isArray(doc.version_history) ? doc.version_history.length : 1

            return (
              <Card
                key={doc.id}
                className="bg-[#141414] border border-[#2A2A2A] hover:border-[#D4AF37]/50 transition-colors p-5 rounded-2xl flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#1f1f1f] border border-[#2A2A2A] text-[#D4AF37]">
                      /{doc.slug}
                    </span>
                    <Badge
                      className={`text-[10px] uppercase font-montserrat ${
                        doc.status === 'publicado'
                          ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                          : doc.status === 'rascunho'
                            ? 'bg-[#EAB308]/15 border-[#EAB308]/40 text-[#EAB308]'
                            : 'bg-[#6B7280]/15 border-[#6B7280]/40 text-[#9CA3AF]'
                      }`}
                    >
                      {doc.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold font-montserrat text-white text-base leading-snug">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-3 mt-1.5 leading-relaxed">
                      {doc.body.replace(/[#*`_>]/g, '').slice(0, 140)}...
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-[#D4AF37]" /> v{doc.version}.0
                    </span>
                    <span>•</span>
                    <span className="capitalize">{doc.audience}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {doc.published_at
                        ? new Date(doc.published_at).toLocaleDateString('pt-BR')
                        : 'Sem data'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#2A2A2A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(doc)}
                      className="h-8 px-2.5 text-xs text-gray-300 hover:text-white hover:bg-[#202020]"
                      title="Editar documento"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistoryDoc(doc)}
                      className="h-8 px-2 text-xs text-gray-400 hover:text-[#D4AF37] hover:bg-[#202020]"
                      title="Ver histórico de versões"
                    >
                      <History className="w-3.5 h-3.5 mr-1" /> {historyCount}
                    </Button>
                  </div>

                  <a
                    href={`/documento/${doc.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-[#D4AF37] hover:underline"
                  >
                    Ver página <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal de Criação / Edição */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl bg-[#141414] border border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-montserrat uppercase flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#D4AF37]" />
              {editingDoc ? `Editar: ${editingDoc.title}` : 'Novo Documento Legal'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Formate o texto em Markdown puro. Os parágrafos, listas e blocos de destaque (&gt;)
              serão estilizados automaticamente no tema visual 369.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Título do Documento
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Termos de Uso do Aluno"
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-9"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Slug URL (Identificador Único)
                </label>
                <Input
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                    })
                  }
                  placeholder="ex: termos-aluno"
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-9 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Público-alvo
                </label>
                <Select
                  value={formData.audience}
                  onValueChange={(val: any) => setFormData({ ...formData, audience: val })}
                >
                  <SelectTrigger className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
                    <SelectItem value="aluno">Alunos / Clientes</SelectItem>
                    <SelectItem value="profissional">Profissionais</SelectItem>
                    <SelectItem value="todos">Todos (Geral)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
                    <SelectItem value="publicado">Publicado (Visível)</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingDoc && (
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] text-xs">
                    <input
                      type="checkbox"
                      checked={formData.incrementVersion}
                      onChange={(e) =>
                        setFormData({ ...formData, incrementVersion: e.target.checked })
                      }
                      className="rounded border-[#2A2A2A] text-[#D4AF37] focus:ring-[#D4AF37]"
                    />
                    <span className="font-semibold text-white">
                      Incrementar Versão (v{(editingDoc.version || 1) + 1}.0)
                    </span>
                  </label>
                  <span className="text-[10px] text-gray-400 mt-1">
                    Exige re-aceite de todos os usuários
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300">
                  Conteúdo do Documento (Markdown / Richtext)
                </label>
                <span className="text-[10px] text-gray-400">
                  Suporta cabeçalhos (#, ##), listas (-), negrito (**) e citações (&gt;)
                </span>
              </div>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={14}
                className="bg-[#181818] border-[#2A2A2A] text-white text-xs font-mono leading-relaxed p-3"
                placeholder="Insira as cláusulas contratuais aqui em markdown..."
                required
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#2A2A2A]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditorOpen(false)}
                className="border-[#2A2A2A] text-gray-300 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#D4AF37] text-black hover:bg-[#e0be4a] font-montserrat uppercase font-bold text-xs"
              >
                <Save className="w-4 h-4 mr-1.5" /> Salvar e Publicar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico de Versões */}
      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-2xl bg-[#141414] border border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat uppercase flex items-center gap-2">
              <History className="w-5 h-5 text-[#D4AF37]" />
              Histórico de Versões: {historyDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Versão atual ativa: <strong>v{historyDoc?.version}.0</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {historyDoc?.version_history && historyDoc.version_history.length > 0 ? (
              historyDoc.version_history.map((hist, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#D4AF37] font-mono mr-2">
                      v{hist.version}.0
                    </span>
                    <span className="text-white font-semibold">{hist.title}</span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Publicado em:{' '}
                      {hist.published_at
                        ? new Date(hist.published_at).toLocaleString('pt-BR')
                        : 'Data não informada'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewHistoryItem(hist)}
                    className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs h-7"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver texto
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">
                Nenhum histórico anterior registrado para este documento.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Pré-visualização do Histórico Antigo */}
      <Dialog
        open={!!previewHistoryItem}
        onOpenChange={(open) => !open && setPreviewHistoryItem(null)}
      >
        <DialogContent className="max-w-2xl bg-[#141414] border border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-montserrat">
              Versão {previewHistoryItem?.version}.0 — {previewHistoryItem?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Registrado em {previewHistoryItem?.published_at}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap font-mono p-3 bg-[#181818] rounded-xl border border-[#2A2A2A]">
            {previewHistoryItem?.body}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AdminDocumentosLegais
