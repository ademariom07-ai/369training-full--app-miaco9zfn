import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Award, Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface PerfilServiceItem {
  id: string
  title?: string
  type: string
  value?: number
  notes?: string
  status: string
}

type ServiceKind = 'servico' | 'curso'

interface ServiceForm {
  title: string
  kind: ServiceKind
  value: string
  notes: string
}

const EMPTY_FORM: ServiceForm = { title: '', kind: 'servico', value: '', notes: '' }

const KIND_LABELS: Record<string, string> = { servico: 'Serviço', curso: 'Curso' }

export function ProfServicosCard() {
  const { user } = useAuth()
  const [services, setServices] = useState<PerfilServiceItem[]>([])
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<{ title?: string; value?: string }>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PerfilServiceItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await pb.collection('services').getList<PerfilServiceItem>(1, 50, {
        filter: `professional = "${user.id}"`,
        sort: '-created',
      })
      setServices(res.items)
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (svc: PerfilServiceItem) => {
    setEditingId(svc.id)
    setForm({
      title: svc.title || '',
      kind: svc.type === 'curso' ? 'curso' : 'servico',
      value: typeof svc.value === 'number' ? String(svc.value) : '',
      notes: svc.notes || '',
    })
    setErrors({})
    setFormOpen(true)
  }

  const validate = (): boolean => {
    const next: { title?: string; value?: string } = {}
    if (!form.title.trim()) next.title = 'Informe o título do serviço.'
    const v = Number(form.value.replace(',', '.'))
    if (form.value.trim() === '' || Number.isNaN(v) || v < 0) {
      next.value = 'Informe um preço válido (zero ou mais).'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!validate()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      type: form.kind,
      value: Number(form.value.replace(',', '.')),
      notes: form.notes.trim(),
    }
    try {
      if (editingId) {
        await pb.collection('services').update(editingId, payload)
        toast.success('Serviço atualizado!')
      } else {
        await pb.collection('services').create({
          ...payload,
          professional: user.id,
          student: user.id,
          status: 'pendente',
        })
        toast.success('Serviço adicionado!')
      }
      setFormOpen(false)
      await load()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Não foi possível salvar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await pb.collection('services').delete(deleteTarget.id)
      toast.success('Serviço excluído.')
      setDeleteTarget(null)
      await load()
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Não foi possível excluir o serviço.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-2xl min-h-[320px]">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h3 className="font-bold font-montserrat text-white text-base uppercase flex items-center gap-2">
          <Award className="w-5 h-5 text-[#22C55E]" /> Serviços & Cursos Disponíveis
        </h3>
        <Button
          type="button"
          onClick={openCreate}
          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-[11px] uppercase rounded-xl h-10 px-4 flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Adicionar serviço
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="p-6 text-center text-gray-400 text-xs">Carregando serviços...</p>
        ) : services.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#141414] border border-[#2A2A2A] text-center space-y-3">
            <p className="text-white font-bold font-montserrat text-xs uppercase">
              Nenhum serviço cadastrado — adicione seu primeiro serviço
            </p>
            <Button
              type="button"
              onClick={openCreate}
              variant="outline"
              className="bg-transparent border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-[11px] font-bold uppercase rounded-xl h-10 px-4"
            >
              <Plus className="w-4 h-4 mr-1" /> Adicionar serviço
            </Button>
          </div>
        ) : (
          services.map((svc) => (
            <div
              key={svc.id}
              className="p-4 sm:p-5 rounded-xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-white font-montserrat truncate">
                  {svc.title || KIND_LABELS[svc.type] || svc.type}
                </p>
                <p className="text-[11px] text-gray-400 font-inter mt-1">
                  {KIND_LABELS[svc.type] || svc.type}
                  {svc.notes ? ` • ${svc.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#D4AF37] font-mono mr-1">
                  {typeof svc.value === 'number'
                    ? svc.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </span>
                <button
                  type="button"
                  aria-label="Editar serviço"
                  onClick={() => openEdit(svc)}
                  className="w-10 h-10 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-center text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Excluir serviço"
                  onClick={() => setDeleteTarget(svc)}
                  className="w-10 h-10 rounded-xl bg-[#181818] border border-[#2A2A2A] flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-500/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formulário de adicionar / editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-montserrat uppercase text-base">
              {editingId ? 'Editar serviço' : 'Adicionar serviço'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Título *
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Consultoria Mensal Completa"
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-sm text-white h-12"
              />
              {errors.title && <p className="text-[11px] text-red-400 mt-1">{errors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Tipo
                </label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as ServiceKind })}
                  className="w-full h-12 px-3 bg-[#141414] border border-[#2A2A2A] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                >
                  <option value="servico">Serviço</option>
                  <option value="curso">Curso</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Preço (R$) *
                </label>
                <Input
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="250,00"
                  className="bg-[#141414] border-[#2A2A2A] rounded-xl text-sm text-white font-mono h-12"
                />
                {errors.value && <p className="text-[11px] text-red-400 mt-1">{errors.value}</p>}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Descrição
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Ex: Treinos semanais + suporte WhatsApp"
                className="w-full p-3 bg-[#141414] border border-[#2A2A2A] rounded-xl text-white text-sm focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="bg-transparent border-[#2A2A2A] text-gray-300 rounded-xl h-11"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase rounded-xl h-11 px-6"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-montserrat uppercase text-base">
              Excluir serviço?
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400">
            "{deleteTarget?.title || 'Serviço'}" será removido permanentemente. Deseja continuar?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="bg-transparent border-[#2A2A2A] text-gray-300 rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-500 font-bold text-xs uppercase rounded-xl h-11 px-6"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
