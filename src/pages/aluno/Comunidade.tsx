import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import {
  Trophy,
  Flame,
  Heart,
  MessageCircle,
  Calendar,
  Send,
  Flag,
  ImagePlus,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 50
const MAX_LEN = 2000
const MAX_MEDIA_BYTES = 50 * 1024 * 1024 // 50 MB
const ACCEPTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']

interface AuthorInfo {
  id?: string
  collectionId?: string
  collectionName?: string
  name?: string
  avatar?: string
}

interface PostRecord {
  id: string
  user: string
  content: string
  media: string[]
  likes: number
  reported?: boolean
  created: string
  expand?: {
    user?: AuthorInfo
  }
}

interface CommentRecord {
  id: string
  post: string
  user: string
  content: string
  created: string
  expand?: {
    user?: AuthorInfo
  }
}

interface LikeRecord {
  id: string
  post: string
  user: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `Há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Há ${days} d`
  const months = Math.floor(days / 30)
  if (months < 12) return `Há ${months} ${months === 1 ? 'mês' : 'meses'}`
  return `Há ${Math.floor(months / 12)} a`
}

export default function Comunidade() {
  const { user } = useAuth()
  const [postText, setPostText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [posting, setPosting] = useState(false)
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentRecord[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [sendingComment, setSendingComment] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null)
  const [reportPostId, setReportPostId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [sendingReport, setSendingReport] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  const isMediaValid = (file: File): string | null => {
    if (file.size > MAX_MEDIA_BYTES) {
      return 'Arquivo muito grande. O limite é 50 MB por arquivo.'
    }
    if (!ACCEPTED_MEDIA.includes(file.type)) {
      return 'Tipo de arquivo inválido. Aceitos: JPG, PNG, WEBP (imagens) ou MP4, WEBM (vídeos).'
    }
    return null
  }

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const error = isMediaValid(file)
    if (error) {
      toast.error(error)
      e.target.value = ''
      return
    }
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaFile(null)
    setMediaPreview(null)
  }

  const loadPosts = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      try {
        const result = await pb
          .collection('community_posts')
          .getList<PostRecord>(targetPage, PAGE_SIZE, {
            sort: '-created',
            expand: 'user',
          })
        setPosts((prev) => (append ? [...prev, ...result.items] : result.items))
        setTotalPages(result.totalPages)
        setPage(result.page)

        // Curtidas do usuário logado (em lote, uma chamada)
        if (user && result.items.length > 0) {
          const ids = result.items.map((p) => p.id).join('" || post="')
          const filter = `user = "${user.id}" && (post = "${ids}")`
          try {
            const likes = await pb.collection('community_post_likes').getFullList<LikeRecord>({
              filter,
            })
            setLikedPostIds((prev) => {
              const next = new Set(append ? prev : new Set<string>())
              likes.forEach((l) => next.add(l.post))
              return next
            })
          } catch {
            // Sem curtidas carregadas — segue sem marcar
          }
        }
      } catch {
        toast.error('Não foi possível carregar o feed da comunidade.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user],
  )

  useEffect(() => {
    loadPosts(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const checkTerms = async () => {
      if (!user) return
      try {
        const rec = await pb.collection('chat_terms_acceptances').getList(1, 1, {
          filter: `user = "${user.id}"`,
        })
        setTermsAccepted(rec.items.length > 0)
      } catch {
        setTermsAccepted(false)
      }
    }
    checkTerms()
  }, [user])

  const handleAcceptTerms = async () => {
    if (!user) return
    try {
      await pb.collection('chat_terms_acceptances').create({
        user: user.id,
        accepted_at: new Date().toISOString(),
        ip_address: 'browser-client',
        user_agent: navigator.userAgent.slice(0, 200),
        version: '1.0',
      })
      setTermsAccepted(true)
      toast.success('Termos da comunidade aceitos com sucesso!')
    } catch {
      toast.error('Erro ao registrar aceite dos termos.')
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!postText.trim()) {
      toast.error('Escreva algo antes de publicar.')
      return
    }
    if (postText.length > MAX_LEN) {
      toast.error(`O post excede o limite de ${MAX_LEN} caracteres.`)
      return
    }
    if (termsAccepted !== true) {
      toast.error('Aceite os termos da comunidade antes de publicar.')
      return
    }
    if (mediaFile) {
      const error = isMediaValid(mediaFile)
      if (error) {
        toast.error(error)
        return
      }
    }

    setPosting(true)
    try {
      const formData = new FormData()
      formData.append('user', user.id)
      formData.append('content', postText.trim())
      if (mediaFile) formData.append('media', mediaFile)

      await pb.collection('community_posts').create(formData)
      setPostText('')
      clearMedia()
      toast.success('Publicação compartilhada na comunidade 369!')
      await loadPosts(1, false)
    } catch (err: unknown) {
      const error = err as {
        response?: { message?: string; data?: Record<string, { message?: string }> }
      }
      const detail = error?.response?.data
      const detailMsg = detail
        ? Object.values(detail)
            .map((d) => d?.message)
            .filter(Boolean)
            .join(' ')
        : undefined
      toast.error(detailMsg || error?.response?.message || 'Erro ao publicar. Tente novamente.')
    } finally {
      setPosting(false)
    }
  }

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId)
    try {
      await pb.collection('community_posts').delete(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Post apagado.')
    } catch {
      toast.error('Erro ao apagar o post.')
    } finally {
      setDeletingPostId(null)
    }
  }

  const handleLike = async (post: PostRecord) => {
    if (!user) return
    const already = likedPostIds.has(post.id)
    try {
      if (already) {
        const existing = await pb.collection('community_post_likes').getList(1, 1, {
          filter: `user = "${user.id}" && post = "${post.id}"`,
        })
        if (existing.items.length > 0) {
          await pb.collection('community_post_likes').delete(existing.items[0].id)
        }
        setLikedPostIds((prev) => {
          const next = new Set(prev)
          next.delete(post.id)
          return next
        })
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, likes: Math.max(0, (p.likes || 0) - 1) } : p,
          ),
        )
      } else {
        await pb.collection('community_post_likes').create({
          post: post.id,
          user: user.id,
        })
        setLikedPostIds((prev) => new Set(prev).add(post.id))
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p)),
        )
      }
    } catch {
      toast.error('Erro ao registrar curtida.')
    }
  }

  const toggleComments = async (postId: string) => {
    const isOpen = openComments.has(postId)
    setOpenComments((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(postId)
      else next.add(postId)
      return next
    })
    if (!isOpen && !commentsByPost[postId]) {
      try {
        const res = await pb.collection('community_post_comments').getList<CommentRecord>(1, 50, {
          filter: `post = "${postId}"`,
          sort: 'created',
          expand: 'user',
        })
        setCommentsByPost((prev) => ({ ...prev, [postId]: res.items }))
      } catch {
        toast.error('Erro ao carregar comentários.')
      }
    }
  }

  const handleSendComment = async (postId: string) => {
    if (!user) return
    const text = (commentDraft[postId] || '').trim()
    if (!text) return
    setSendingComment(postId)
    try {
      const created = await pb
        .collection('community_post_comments')
        .create<CommentRecord>({ post: postId, user: user.id, content: text }, { expand: 'user' })
      setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), created] }))
      setCommentDraft((prev) => ({ ...prev, [postId]: '' }))
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message || 'Erro ao comentar.')
    } finally {
      setSendingComment(null)
    }
  }

  const handleConfirmReport = async () => {
    if (!reportPostId || !reportReason.trim()) return
    setSendingReport(true)
    try {
      await pb.collection('community_posts').update(reportPostId, {
        reported: true,
        report_reason: reportReason.trim().slice(0, 500),
      })
      setPosts((prev) => prev.filter((p) => p.id !== reportPostId))
      toast.success('Denúncia registrada com sucesso para auditoria da moderação.')
      setReportPostId(null)
      setReportReason('')
    } catch {
      toast.error('Erro ao registrar denúncia.')
    } finally {
      setSendingReport(false)
    }
  }

  const mediaUrlOf = (post: PostRecord) =>
    post.media && post.media.length > 0
      ? pb.files.getURL(post as unknown as Parameters<typeof pb.files.getURL>[0], post.media[0])
      : null

  const isImage = (filename: string) => /\.(jpe?g|png|webp)$/i.test(filename)
  const isVideo = (filename: string) => /\.(mp4|webm)$/i.test(filename)

  const renderMedia = (post: PostRecord) => {
    const url = mediaUrlOf(post)
    if (!url || !post.media?.[0]) return null
    const filename = post.media[0]
    if (isImage(filename)) {
      return (
        <img
          src={url}
          alt="Mídia do post"
          className="w-full max-h-96 object-cover rounded-xl border border-[#2A2A2A]"
          loading="lazy"
        />
      )
    }
    if (isVideo(filename)) {
      return (
        <video
          src={url}
          controls
          preload="metadata"
          className="w-full max-h-96 rounded-xl border border-[#2A2A2A] bg-black"
        />
      )
    }
    return null
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
              <Textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Compartilhe seu treino, carga, conquista ou evolução..."
                className="bg-[#141414] border-[#2A2A2A] rounded-xl text-xs text-white min-h-[70px]"
                maxLength={MAX_LEN}
              />
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>
                  {postText.length}/{MAX_LEN}
                </span>
              </div>

              {mediaPreview && (
                <div className="relative">
                  {mediaFile?.type.startsWith('video/') ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="w-full max-h-56 rounded-xl border border-[#2A2A2A] bg-black"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Pré-visualização do anexo"
                      className="w-full max-h-56 object-cover rounded-xl border border-[#2A2A2A]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-[#2A2A2A] flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                    aria-label="Remover anexo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white cursor-pointer font-inter transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  Anexar foto/vídeo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                    onChange={handleMediaSelect}
                    className="hidden"
                    disabled={posting}
                  />
                </label>
                <Button
                  type="submit"
                  size="sm"
                  disabled={posting || !postText.trim() || termsAccepted !== true}
                  className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-bold text-xs flex items-center gap-1.5"
                >
                  {posting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Publicar
                </Button>
              </div>
              {termsAccepted === false && (
                <p className="text-[11px] text-amber-400 font-inter">
                  Aceite os termos da comunidade (abaixo) antes de publicar.
                </p>
              )}
            </form>
          </Card>

          {/* Posts List */}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <Card className="bg-[#181818] border border-[#2A2A2A] p-8 rounded-2xl text-center">
              <p className="text-sm text-gray-400 font-inter">
                Nenhuma publicação ainda. Seja o primeiro a compartilhar uma conquista!
              </p>
            </Card>
          ) : (
            posts.map((post) => {
              const liked = likedPostIds.has(post.id)
              const isOwner = user?.id === post.user
              const expandedAuthor = post.expand?.user
              const showTermsPrompt = termsAccepted === false
              return (
                <Card
                  key={post.id}
                  className="bg-[#181818] border border-[#2A2A2A] p-5 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={expandedAuthor} className="w-9 h-9 rounded-full text-xs" />
                      <div>
                        <h4 className="text-xs font-bold font-montserrat text-white">
                          {expandedAuthor?.name || 'Atleta 369'}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-inter">
                          {timeAgo(post.created)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReportPostId(post.id)
                          setReportReason('')
                        }}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        aria-label="Denunciar post"
                        title="Denunciar post"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingPostId === post.id}
                          className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label="Apagar post"
                          title="Apagar post"
                        >
                          {deletingPostId === post.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-200 font-inter leading-relaxed whitespace-pre-wrap break-words">
                    {post.content}
                  </p>

                  {renderMedia(post)}

                  <div className="flex items-center gap-6 pt-2 border-t border-[#2A2A2A] text-xs text-gray-400">
                    <button
                      type="button"
                      onClick={() => handleLike(post)}
                      className={`flex items-center gap-1.5 transition-colors ${
                        liked ? 'text-red-500' : 'hover:text-red-400'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${liked ? 'fill-red-500' : ''}`} />
                      <span>{post.likes || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 hover:text-white"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Comentar
                      {commentsByPost[post.id]?.length ? (
                        <span className="text-[10px] text-gray-500">
                          ({commentsByPost[post.id].length})
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {openComments.has(post.id) && (
                    <div className="pt-2 space-y-2">
                      {(commentsByPost[post.id] || []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <UserAvatar
                            user={c.expand?.user}
                            className="w-6 h-6 rounded-full text-[9px]"
                          />
                          <div className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white font-montserrat">
                                {c.expand?.user?.name || 'Atleta 369'}
                              </span>
                              <span className="text-[9px] text-gray-500">{timeAgo(c.created)}</span>
                            </div>
                            <p className="text-[11px] text-gray-300 font-inter mt-0.5 whitespace-pre-wrap break-words">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2">
                        <UserAvatar user={user} className="w-6 h-6 rounded-full text-[9px]" />
                        <input
                          type="text"
                          value={commentDraft[post.id] || ''}
                          onChange={(e) =>
                            setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSendComment(post.id)
                            }
                          }}
                          placeholder="Escreva um comentário..."
                          maxLength={1000}
                          className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-[11px] text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/50"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSendComment(post.id)}
                          disabled={sendingComment === post.id || !commentDraft[post.id]?.trim()}
                          className="bg-[#D4AF37] text-black hover:bg-[#E6C65C] h-7 px-2.5"
                        >
                          {sendingComment === post.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })
          )}

          {posts.length > 0 && page < totalPages && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => loadPosts(page + 1, true)}
                disabled={loadingMore}
                className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>

        {/* Lives & Aulas Especiais Upcoming */}
        <div className="space-y-4">
          {termsAccepted === false && (
            <Card className="bg-[#181818] border border-amber-500/30 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-bold font-montserrat text-white text-sm uppercase">
                  Termos da Comunidade
                </h3>
              </div>
              <p className="text-[11px] text-gray-400 font-inter leading-relaxed">
                Para publicar na comunidade 369, aceite as regras de convivência: respeito mútuo,
                proibição de assédio, discriminação e conteúdo ilegal. As publicações constituem
                documento válido e podem ser moderadas pela administração.
              </p>
              <Button
                type="button"
                onClick={handleAcceptTerms}
                className="w-full bg-[#D4AF37] text-black hover:bg-[#E6C65C] font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aceitar Termos da Comunidade
              </Button>
            </Card>
          )}

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

      {/* Modal de Denúncia de Post */}
      {reportPostId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !sendingReport && setReportPostId(null)}
        >
          <div
            className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Flag className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold font-montserrat text-white uppercase">
                Denunciar Post
              </h3>
            </div>
            <p className="text-xs text-gray-400 font-inter">
              A publicação denunciada será encaminhada com registro de auditoria para revisão da
              administração do 369WELLNESS e sairá do seu feed.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Descreva o motivo da denúncia..."
              maxLength={500}
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/50 min-h-[90px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={sendingReport}
                onClick={() => setReportPostId(null)}
                className="border-[#2A2A2A] text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={sendingReport || !reportReason.trim()}
                onClick={handleConfirmReport}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase rounded-xl px-4 flex items-center gap-1.5"
              >
                {sendingReport ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Flag className="w-3.5 h-3.5" />
                )}
                Enviar Denúncia
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
