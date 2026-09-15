import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Radio,
  ExternalLink,
  BookOpen,
  Award,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Calendar,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'

export interface RadarItem {
  title: string
  evidence_level: string
  source_name: string
  source_url: string
  summary: string
  council_update?: string
  content_suggestion?: string
}

export interface RadarBriefingRecord {
  id: string
  specialty: string
  cycle: string
  items: RadarItem[]
  published_at?: string
  is_mock?: boolean
}

interface Radar369SectionProps {
  specialties?: string[]
}

export function Radar369Section({ specialties = ['Educação Física'] }: Radar369SectionProps) {
  const [briefings, setBriefings] = useState<RadarBriefingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSpecialty, setActiveSpecialty] = useState<string>(
    specialties[0] || 'Educação Física',
  )

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    pb.collection('radar_briefings')
      .getList<RadarBriefingRecord>(1, 20, {
        sort: '-created',
      })
      .then((res) => {
        if (!isMounted) return
        if (res.items && res.items.length > 0) {
          setBriefings(res.items)
          const availableSpecs = Array.from(new Set(res.items.map((i) => i.specialty)))
          if (availableSpecs.includes(activeSpecialty)) {
            // Keep current
          } else if (availableSpecs.length > 0) {
            setActiveSpecialty(availableSpecs[0])
          }
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar Radar 369:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const currentBriefing = briefings.find((b) => b.specialty === activeSpecialty) || briefings[0]

  const distinctSpecs = Array.from(
    new Set([...specialties, ...briefings.map((b) => b.specialty)]),
  ).filter(Boolean)

  return (
    <Card className="bg-[#151515] border border-[#00C853]/40 p-6 rounded-2xl shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2A2A2A]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00C853] uppercase tracking-wider font-montserrat">
              <Radio className="w-4 h-4 text-[#00C853] animate-pulse" /> Radar 369 • O que há de
              novo na Web
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] border border-[#00C853]/30">
              Briefing Semanal
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-montserrat text-white uppercase">
            Radar Científico & Tendências
          </h2>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Evidências científicas com link da fonte, classificação de evidência, diretrizes dos
            conselhos e sugestões de conteúdo. O Radar entrega links e evidências — nunca prescreve.
          </p>
        </div>

        {/* Badge Ciclo */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-[#2A2A2A] text-xs font-mono text-gray-300">
          <Calendar className="w-3.5 h-3.5 text-[#00C853]" />
          <span>Ciclo: {currentBriefing?.cycle || '2026-W1'}</span>
        </div>
      </div>

      {/* Tabs de Especialidade */}
      <div className="flex flex-wrap gap-2">
        {distinctSpecs.map((spec) => {
          const isActive = activeSpecialty === spec
          return (
            <button
              key={spec}
              type="button"
              onClick={() => setActiveSpecialty(spec)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${
                isActive
                  ? 'bg-[#00C853] text-black shadow-md'
                  : 'bg-[#1E1E1E] text-gray-300 hover:text-white border border-[#2A2A2A]'
              }`}
            >
              {spec}
            </button>
          )
        })}
      </div>

      {/* Card Body */}
      {loading ? (
        <div className="p-8 text-center text-xs text-gray-400 font-inter">
          Consultando evidências científicas e atualizações dos conselhos...
        </div>
      ) : !currentBriefing || !currentBriefing.items || currentBriefing.items.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400 font-inter bg-black/20 rounded-xl border border-white/5">
          Nenhum briefing publicado para esta especialidade no ciclo corrente.
        </div>
      ) : (
        <div className="space-y-4">
          {currentBriefing.is_mock && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-inter flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Ambiente com dados demonstrativos sinalizados como <strong>[TESTE]</strong> para
                validação da esteira do cron semanal.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentBriefing.items.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#00C853]/60 transition-all space-y-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] border border-[#00C853]/30">
                      {item.evidence_level || 'Evidência Forte'}
                    </span>
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Abrir Fonte Original"
                    >
                      <ExternalLink className="w-4 h-4 text-[#00C853]" />
                    </a>
                  </div>

                  <h3 className="text-sm font-bold font-montserrat text-white leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-300 font-inter leading-relaxed mt-2">
                    {item.summary}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#2A2A2A] text-[11px]">
                  {/* Fonte */}
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{item.source_name}</span>
                  </div>

                  {/* Atualização de Conselho */}
                  {item.council_update && (
                    <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-blue-200">
                      <div className="font-bold flex items-center gap-1 text-[10px] uppercase font-montserrat text-blue-300 mb-0.5">
                        <Award className="w-3 h-3 text-blue-400" /> Atualização Regulatória
                      </div>
                      <p className="font-inter leading-tight">{item.council_update}</p>
                    </div>
                  )}

                  {/* Sugestão de Conteúdo */}
                  {item.content_suggestion && (
                    <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-purple-200">
                      <div className="font-bold flex items-center gap-1 text-[10px] uppercase font-montserrat text-purple-300 mb-0.5">
                        <Lightbulb className="w-3 h-3 text-purple-400" /> Sugestão de Conteúdo
                      </div>
                      <p className="font-inter leading-tight">{item.content_suggestion}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
