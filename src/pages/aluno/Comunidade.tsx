import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Flame, Heart, MessageCircle, Share2, Calendar, Sparkles, Send } from 'lucide-react'
import { toast } from 'sonner'

export default function Comunidade() {
  const { user } = useAuth()
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState([
    {
      id: 'cp1',
      author: 'Lucas Ferreira',
      time: 'Há 2 horas',
      content:
        'Bati meu recorde pessoal no supino hoje! 4x8 com 35kg cada lado. A periodização gerada pela IA e ajustada pelo Prof. Carlos foi perfeita! 🔥💪',
      image: 'https://img.usecurling.com/p/600/350?q=gym%20workout%20benchpress',
      likes: 24,
      liked: false,
    },
    {
      id: 'cp2',
      author: 'Dra. Marina Santos',
      time: 'Há 5 horas',
      content:
        'Dica do dia: Nunca negligencie os testes de mobilidade articular de tornozelo antes dos agachamentos pesados. Prevenção é evolução.',
      image: '',
      likes: 42,
      liked: true,
    },
  ])

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!postText.trim()) return

    const newPost = {
      id: 'post_' + Date.now(),
      author: user?.name || 'Atleta 369',
      time: 'Agora mesmo',
      content: postText,
      image: '',
      likes: 0,
      liked: false,
    }

    setPosts([newPost, ...posts])
    setPostText('')
    toast.success('Publicação compartilhada na comunidade 369!')
  }

  const handleLike = (id: string) => {
    setPosts(
      posts.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            likes: p.liked ? p.likes - 1 : p.likes + 1,
            liked: !p.liked,
          }
        }
        return p
      }),
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7A00]/10 border border-[#FF7A00]/30 text-xs font-bold text-[#FF7A00] uppercase font-montserrat mb-2">
          <Flame className="w-3.5 h-3.5" />
          Comunidade & Desafios 369
        </div>
        <h1 className="text-3xl font-extrabold font-montserrat text-white uppercase">
          Feed de Evolução & Desafios
        </h1>
        <p className="text-sm text-gray-400 font-inter mt-1">
          Compartilhe suas vitórias diárias, dispute desafios semanais e celebre a evolução dos
          colegas.
        </p>
      </div>

      {/* DESAFIOS SEMANAIS (CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-[#FF7A00] uppercase bg-[#FF7A00]/10 px-2 py-0.5 rounded border border-[#FF7A00]/30">
              Desafio Semanal
            </span>
            <Trophy className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h3 className="text-sm font-bold font-montserrat text-white">
            5 Dias de Treino Sem Falhar
          </h3>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Meta: Concluir 5 treinos até domingo.
          </p>
          <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex justify-between items-center text-xs">
            <span className="text-gray-400">Progresso: 4/5</span>
            <Button
              size="sm"
              className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-[11px] h-7"
            >
              Participar
            </Button>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-[#22C55E] uppercase bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/30">
              Nutrição
            </span>
            <Trophy className="w-5 h-5 text-[#22C55E]" />
          </div>
          <h3 className="text-sm font-bold font-montserrat text-white">Hidratação 3L por 7 Dias</h3>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Meta: Registrar fotos e consumo diário de água.
          </p>
          <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex justify-between items-center text-xs">
            <span className="text-gray-400">Progresso: 5/7</span>
            <Button
              size="sm"
              className="bg-[#22C55E] text-black hover:bg-[#1fb354] font-bold text-[11px] h-7"
            >
              Participar
            </Button>
          </div>
        </Card>

        <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-[#0057FF] uppercase bg-[#0057FF]/10 px-2 py-0.5 rounded border border-[#0057FF]/30">
              Combate / Cardio
            </span>
            <Trophy className="w-5 h-5 text-[#0057FF]" />
          </div>
          <h3 className="text-sm font-bold font-montserrat text-white">100 Rounds no Mês</h3>
          <p className="text-xs text-gray-400 font-inter mt-1">
            Meta: 100 rounds de sparring ou saco de pancada.
          </p>
          <div className="mt-4 pt-3 border-t border-[#2A2A2A] flex justify-between items-center text-xs">
            <span className="text-gray-400">Progresso: 68/100</span>
            <Button
              size="sm"
              className="bg-[#0057FF] text-white hover:bg-[#1a66ff] font-bold text-[11px] h-7"
            >
              Participar
            </Button>
          </div>
        </Card>
      </div>

      {/* FEED DE POSTAGENS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed Posts (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Create Post Card */}
          <Card className="bg-[#181818] border border-[#2A2A2A] p-4 rounded-2xl">
            <form onSubmit={handleCreatePost} className="space-y-3">
              <Input
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Compartilhe seu treino, carga, conquista ou evolução..."
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-gray-500 font-inter">
                  Inspire outros atletas 369
                </span>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Publicar
                </Button>
              </div>
            </form>
          </Card>

          {/* Posts List */}
          {posts.map((post) => (
            <Card
              key={post.id}
              className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center font-montserrat text-xs">
                    {post.author[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-montserrat text-white">{post.author}</h4>
                    <p className="text-[10px] text-gray-400 font-inter">{post.time}</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-200 font-inter leading-relaxed">{post.content}</p>

              {post.image && (
                <img
                  src={post.image}
                  alt="Post attachment"
                  className="w-full h-56 object-cover rounded-xl border border-[#2A2A2A]"
                />
              )}

              <div className="flex items-center gap-6 pt-2 border-t border-[#2A2A2A] text-xs text-gray-400">
                <button
                  type="button"
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    post.liked ? 'text-red-500' : 'hover:text-red-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.liked ? 'fill-red-500' : ''}`} />
                  <span>{post.likes}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Comentários abertos em breve.')}
                  className="flex items-center gap-1.5 hover:text-white"
                >
                  <MessageCircle className="w-4 h-4" /> Comentar
                </button>
              </div>
            </Card>
          ))}
        </div>

        {/* Lives & Aulas Especiais Upcoming */}
        <div>
          <Card className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl">
            <h3 className="font-bold font-montserrat text-white text-sm uppercase mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              Lives & Workshops 369
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                <span className="text-[10px] font-bold text-[#D4AF37] uppercase">
                  Quinta-feira • 19:30
                </span>
                <p className="font-bold text-white font-montserrat mt-0.5">
                  Biohacking & Sono Reparador para Hipertrofia
                </p>
                <p className="text-[10px] text-gray-400 font-inter mt-1">Com Prof. Carlos Silva</p>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-[#2A2A2A]">
                <span className="text-[10px] font-bold text-[#0057FF] uppercase">
                  Sábado • 10:00
                </span>
                <p className="font-bold text-white font-montserrat mt-0.5">
                  Workshop de Mobilidade de Quadril e Joelho
                </p>
                <p className="text-[10px] text-gray-400 font-inter mt-1">Com Dra. Marina Santos</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
