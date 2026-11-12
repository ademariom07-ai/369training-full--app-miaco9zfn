import React, { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { CrmContactRecord, CrmContactType, CrmOrigin } from '@/services/crm'

// ---------- Tipos dos filtros do funil (Kanban) ----------
export type KanbanTypeFilter = CrmContactType | 'todos'
export type KanbanOriginFilter = CrmOrigin | 'todas'

const KANBAN_TYPE_OPTIONS: Array<{
  value: KanbanTypeFilter
  label: string
  /** Mesmas cores dos badges de classificação já usados nos cards */
  activeClass: string
}> = [
  { value: 'todos', label: 'Todos', activeClass: 'bg-[#D4AF37] text-black border-[#D4AF37]' },
  {
    value: 'cliente',
    label: 'Clientes',
    activeClass: 'bg-[#0057FF]/20 text-[#60A5FA] border-[#0057FF]/50',
  },
  {
    value: 'parceiro',
    label: 'Parceiros',
    activeClass: 'bg-[#22C55E]/20 text-[#4ADE80] border-[#22C55E]/50',
  },
  {
    value: 'fornecedor',
    label: 'Fornecedores',
    activeClass: 'bg-[#A855F7]/20 text-[#C084FC] border-[#A855F7]/50',
  },
]

const KANBAN_ORIGIN_OPTIONS: Array<{ value: KanbanOriginFilter; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'vinculo', label: 'Vínculo' },
  { value: 'chat', label: 'Chat' },
  { value: 'perfil', label: 'Perfil' },
]

// ---------- Hook: aplicação dos filtros (cliente, sem novas consultas) ----------
export function useKanbanFilters(contacts: CrmContactRecord[]) {
  const [typeFilter, setTypeFilter] = useState<KanbanTypeFilter>('todos')
  const [originFilter, setOriginFilter] = useState<KanbanOriginFilter>('todas')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Debounce leve (300ms) da busca por texto
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const hasActiveFilters = typeFilter !== 'todos' || originFilter !== 'todas' || search.length > 0

  const clearFilters = React.useCallback(() => {
    setTypeFilter('todos')
    setOriginFilter('todas')
    setSearchInput('')
    setSearch('')
  }, [])

  const filtered = useMemo(() => {
    const q = search
    return contacts.filter((c) => {
      if (typeFilter !== 'todos' && (c.contact_type || 'cliente') !== typeFilter) return false
      if (originFilter !== 'todas' && c.origin !== originFilter) return false
      if (q) {
        const name = (c.contact_name || '').toLowerCase()
        const email = (c.email || c.expand?.student?.email || '').toLowerCase()
        const phone = (c.phone || c.expand?.student?.phone || '').replace(/\D/g, '')
        const rawPhone = (c.phone || c.expand?.student?.phone || '').toLowerCase()
        const qDigits = q.replace(/\D/g, '')
        const matches =
          name.includes(q) ||
          email.includes(q) ||
          rawPhone.includes(q) ||
          (qDigits.length > 0 && phone.includes(qDigits))
        if (!matches) return false
      }
      return true
    })
  }, [contacts, typeFilter, originFilter, search])

  return {
    state: { typeFilter, originFilter, searchInput },
    setTypeFilter,
    setOriginFilter,
    setSearchInput,
    filtered,
    hasActiveFilters,
    clearFilters,
    filteredCount: filtered.length,
    totalCount: contacts.length,
  }
}

// ---------- Barra de filtros do funil ----------
export const CrmKanbanFiltersBar: React.FC<{
  typeFilter: KanbanTypeFilter
  originFilter: KanbanOriginFilter
  searchInput: string
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
  onTypeChange: (v: KanbanTypeFilter) => void
  onOriginChange: (v: KanbanOriginFilter) => void
  onSearchChange: (v: string) => void
  onClear: () => void
}> = ({
  typeFilter,
  originFilter,
  searchInput,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onTypeChange,
  onOriginChange,
  onSearchChange,
  onClear,
}) => {
  return (
    <div className="rounded-xl bg-[#101010] border border-[#2A2A2A] p-2.5 space-y-2.5">
      {/* Busca + resumo filtrado vs total */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full h-8 bg-[#181818] border border-[#2A2A2A] rounded-lg pl-8 pr-7 text-[11px] text-white placeholder-gray-500 focus:border-[#D4AF37] focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <p className="text-[10px] text-gray-400 font-mono">
            <span className="text-white font-bold">{filteredCount}</span> de {totalCount} contatos
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Filtro por classificação (mesmas cores dos badges) + Filtro por origem */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          {KANBAN_TYPE_OPTIONS.map((opt) => {
            const active = typeFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTypeChange(opt.value)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                  active
                    ? opt.activeClass
                    : 'border-[#2A2A2A] text-gray-400 hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase text-gray-500 font-bold mr-0.5">Origem:</span>
          {KANBAN_ORIGIN_OPTIONS.map((opt) => {
            const active = originFilter === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onOriginChange(opt.value)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                  active
                    ? 'bg-[#181818] text-[#D4AF37] border-[#D4AF37]/60'
                    : 'border-[#2A2A2A] text-gray-400 hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------- Estado vazio (nenhum resultado com os filtros ativos) ----------
export const CrmKanbanEmptyState: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="col-span-full rounded-xl bg-[#101010] border border-[#2A2A2A] py-8 px-4 text-center">
    <Search className="w-6 h-6 text-gray-500 mx-auto mb-2" />
    <p className="text-xs text-gray-300 font-montserrat font-bold">
      Nenhum contato encontrado com esses filtros
    </p>
    <p className="text-[11px] text-gray-500 mt-1">
      Ajuste a busca por texto, a classificação ou a origem e tente novamente.
    </p>
    <button
      type="button"
      onClick={onClear}
      className="mt-3 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all"
    >
      Limpar filtros
    </button>
  </div>
)
