import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export interface AvatarUser {
  id?: string
  collectionId?: string
  collectionName?: string
  avatar?: string
  name?: string
}

/** URL da foto de perfil (miniatura gerada pelo PocketBase) ou null se não houver foto. */
export function getAvatarUrl(user?: AvatarUser | null, thumb = '200x200'): string | null {
  if (!user?.avatar || !user.id || !(user.collectionId || user.collectionName)) return null
  return pb.files.getURL(user as Parameters<typeof pb.files.getURL>[0], user.avatar, { thumb })
}

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

interface UserAvatarProps {
  user?: AvatarUser | null
  /** Classes de tamanho, borda e arredondamento (ex.: "w-12 h-12 rounded-xl"). */
  className?: string
  thumb?: string
}

/** Foto de perfil do usuário; sem foto, mostra as iniciais do nome. */
export function UserAvatar({ user, className, thumb }: UserAvatarProps) {
  const url = getAvatarUrl(user, thumb)
  if (url) {
    return (
      <img
        src={url}
        alt={user?.name || 'Foto de perfil'}
        className={cn('object-cover', className)}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={user?.name || 'Usuário'}
      className={cn(
        'flex items-center justify-center bg-[#F4ECD2] text-[#8A6D1B] font-bold font-montserrat select-none',
        className,
      )}
    >
      <span className="text-[0.8em] leading-none">{initialsOf(user?.name)}</span>
    </div>
  )
}

export default UserAvatar
