import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { UserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'

const MAX_INPUT_BYTES = 15 * 1024 * 1024
const OUTPUT_SIZE = 512

// Recorta o centro da imagem em quadrado e reduz para 512x512 JPEG antes de enviar
async function toSquareJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const size = Math.min(OUTPUT_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  if (!blob) throw new Error('Não foi possível processar a imagem.')
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}

interface AvatarUploaderProps {
  /** Classes de tamanho e estilo da foto (ex.: "w-24 h-24 rounded-2xl border-2 border-[#D4AF37]"). */
  className?: string
}

/** Foto de perfil do usuário logado com botões para trocar e remover. */
export function AvatarUploader({ className }: AvatarUploaderProps) {
  const { user, refreshUser } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).')
      return
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error('A imagem é muito grande. Escolha uma foto de até 15 MB.')
      return
    }
    setBusy(true)
    try {
      const avatar = await toSquareJpeg(file)
      const data = new FormData()
      data.append('avatar', avatar)
      await pb.collection('users').update(user.id, data)
      await refreshUser()
      toast.success('Foto de perfil atualizada!')
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Não foi possível enviar a foto. Tente outra imagem.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await pb.collection('users').update(user.id, { avatar: null })
      await refreshUser()
      toast.success('Foto de perfil removida.')
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Não foi possível remover a foto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <UserAvatar user={user} className={cn('w-24 h-24 rounded-2xl text-3xl', className)} />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Trocar foto de perfil"
        title="Trocar foto"
        className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#D4AF37] text-black flex items-center justify-center shadow-md border-2 border-white hover:bg-[#E6C65C] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
      >
        <Camera className="w-4 h-4" />
      </button>
      {user.avatar && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="Remover foto de perfil"
          title="Remover foto"
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-gray-600 flex items-center justify-center shadow border border-[#E5E3DC] hover:text-red-600 disabled:opacity-60"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        id="avatar-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />
    </div>
  )
}

export default AvatarUploader
