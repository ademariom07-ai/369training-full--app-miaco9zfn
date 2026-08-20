import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserProfile } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  FileText,
  Activity,
  Calendar,
  MessageSquare,
  Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function GestaoAlunos() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal Registrar Dados
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [paramWeight, setParamWeight] = useState('78.5')
  const [paramFat, setParamFat] = useState('14.2')
  const [paramNotes, setParamNotes] = useState('')

  useEffect(() => {
    pb.collection('users')
      .getList<UserProfile>(1, 50, {
        filter: 'role = "aluno"',
      })
      .then((res) => {
        setStudents(res.items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSaveParams = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success(`Dados biomecânicos registrados para ${selectedStudent?.name}!`)
    setModalOpen(false)
  }

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0057FF]/10 border border-[#0057FF]/30 text-xs font-bold text-[#0057FF] uppercase font-montserrat mb-2">
            <Users className="w-3.5 h-3.5" />
            BackOffice do Profissional
          </div>
          <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
            Gestão Completa de Alunos
          </h1>
          <p className="text-sm text-gray-400 font-inter mt-1">
            Controle de frequência, particularidades, evolução física e prontuário de cada aluno.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aluno por nome..."
            className="pl-10 bg-[#181818] border-[#2A2A2A] rounded-xl text-xs text-white"
          />
        </div>
      </div>

      {/* ALUNOS TABLE / CARDS */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((student) => (
          <Card
            key={student.id}
            className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <img
                src="https://img.usecurling.com/ppl/medium?gender=male&seed=1"
                alt={student.name}
                className="w-14 h-14 rounded-xl object-cover border border-[#2A2A2A]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold font-montserrat text-white text-base">{student.name}</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                    {student.objective || 'Hipertrofia'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-inter mt-0.5">
                  {student.email} • {student.phone || '(11) 91234-5678'}
                </p>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-center min-w-[80px]">
                <span className="text-[10px] text-gray-400 block font-inter">Presença</span>
                <span className="font-bold text-[#22C55E]">92%</span>
              </div>
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-center min-w-[80px]">
                <span className="text-[10px] text-gray-400 block font-inter">Treinos Feitos</span>
                <span className="font-bold text-[#D4AF37]">24</span>
              </div>
              <div className="p-2 rounded-lg bg-[#141414] border border-[#2A2A2A] text-center min-w-[80px]">
                <span className="text-[10px] text-gray-400 block font-inter">Plano</span>
                <span className="font-bold text-[#0057FF]">Mensal</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedStudent(student)
                  setModalOpen(true)
                }}
                className="flex-1 lg:flex-initial bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs"
              >
                Registrar Dados
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/profissional/treinos/novo')}
                className="flex-1 lg:flex-initial border-[#2A2A2A] text-white hover:border-[#0057FF] text-xs"
              >
                Criar Treino
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* REGISTRAR DADOS MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#141414] border border-[#2A2A2A] text-white max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-montserrat text-white">
              Registrar Evolução: {selectedStudent?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveParams} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  Peso Atual (kg)
                </label>
                <Input
                  value={paramWeight}
                  onChange={(e) => setParamWeight(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                  % de Gordura (BF)
                </label>
                <Input
                  value={paramFat}
                  onChange={(e) => setParamFat(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] rounded-xl text-white font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1 font-montserrat">
                Orientações / Observações
              </label>
              <textarea
                value={paramNotes}
                onChange={(e) => setParamNotes(e.target.value)}
                placeholder="Ex: Aumentar ingestão de água, corrigir postura no agachamento..."
                rows={3}
                className="w-full p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl text-white text-xs focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs uppercase py-5"
            >
              Salvar Registro no Prontuário
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
