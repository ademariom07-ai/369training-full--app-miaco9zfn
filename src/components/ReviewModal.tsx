import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, Loader2, Award, CheckCircle2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import type { ServiceReviewRecord } from '@/services/api'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId: string
  revieweeId: string
  revieweeName: string
  serviceTitle: string
  existingReview?: ServiceReviewRecord | null
  onSuccess: (savedReview: ServiceReviewRecord) => void
}

export default function ReviewModal({
  isOpen,
  onClose,
  serviceId,
  revieweeId,
  revieweeName,
  serviceTitle,
  existingReview,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(existingReview?.rating || 5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [message, setMessage] = useState<string>(existingReview?.message || '')
  const [submitting, setSubmitting] = useState(false)

  // Reset or initialize when opened
  React.useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5)
      setMessage(existingReview.message || '')
    } else {
      setRating(5)
      setMessage('')
    }
  }, [existingReview, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pb.authStore.record?.id) {
      toast.error('Você precisa estar autenticado para avaliar.')
      return
    }

    if (rating < 1 || rating > 5) {
      toast.error('Por favor, selecione uma nota de 1 a 5 estrelas.')
      return
    }

    setSubmitting(true)
    try {
      let saved: ServiceReviewRecord

      if (existingReview?.id) {
        // Atualizar avaliação existente
        saved = await pb
          .collection('service_reviews')
          .update<ServiceReviewRecord>(existingReview.id, {
            rating,
            message: message.trim(),
          })
        toast.success('Avaliação atualizada com sucesso!')
      } else {
        // Criar nova avaliação
        saved = await pb.collection('service_reviews').create<ServiceReviewRecord>({
          service: serviceId,
          reviewer: pb.authStore.record.id,
          reviewee: revieweeId,
          rating,
          message: message.trim(),
        })
        toast.success('Avaliação enviada com sucesso! Aula validada para coeficiente de pontuação.')
      }

      onSuccess(saved)
      onClose()
    } catch (err: unknown) {
      const error = err as { message?: string }
      toast.error(error.message || 'Erro ao enviar avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  const isReadOnly = Boolean(existingReview && !existingReview.id)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-[#E4E2DC] text-[#1A1A1A] max-w-md rounded-2xl p-6 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#B8962E]">
              <Award className="w-5 h-5 text-[#B8962E]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B8962E] font-montserrat">
              Avaliação Mútua Pós-Aula
            </span>
          </div>
          <DialogTitle className="text-xl font-bold font-montserrat text-[#1A1A1A]">
            Avaliar {revieweeName}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#666666] font-inter">
            {serviceTitle} • Sua avaliação é o gatilho para a validação da aula e pontuação no
            ranking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Estrelas 1 a 5 */}
          <div className="bg-[#F7F5F0] border border-[#E4E2DC] rounded-xl p-4 text-center space-y-2">
            <label className="block text-xs font-semibold text-[#1A1A1A] uppercase font-montserrat">
              Nota do Atendimento
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const activeVal = hoverRating || rating
                const isFilled = star <= activeVal

                return (
                  <button
                    key={star}
                    type="button"
                    disabled={isReadOnly}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    title={`${star} estrela${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        isFilled
                          ? 'fill-[#D4AF37] text-[#D4AF37]'
                          : 'fill-transparent text-[#CCCCCC]'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <p className="text-xs font-mono font-bold text-[#B8962E]">
              {rating === 5 && 'Excelente (5/5)'}
              {rating === 4 && 'Muito Bom (4/5)'}
              {rating === 3 && 'Bom (3/5)'}
              {rating === 2 && 'Regular (2/5)'}
              {rating === 1 && 'Precisa Melhorar (1/5)'}
            </p>
          </div>

          {/* Mensagem Opcional */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1A1A1A] uppercase font-montserrat">
                Deixe uma mensagem (opcional)
              </label>
              <span className="text-[10px] text-[#888888]">Texto livre</span>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva como foi a aula, dedicação, pontualidade, evolução e feedback construtivo..."
              className="bg-white border-[#E4E2DC] text-[#1A1A1A] placeholder:text-[#999999] rounded-xl text-xs min-h-[90px] focus-visible:ring-1 focus-visible:ring-[#0057FF]"
              disabled={isReadOnly}
              maxLength={1000}
            />
          </div>

          {/* Dica informativa de validação */}
          <div className="p-3 rounded-xl bg-[#0057FF]/5 border border-[#0057FF]/20 text-[11px] text-[#0057FF] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0057FF]" />
            <span className="leading-tight text-[#333333]">
              Ao enviar a avaliação, a aula é{' '}
              <strong className="text-[#0057FF]">validada no ranking</strong> e entra no coeficiente
              de pontuação (services_count) de ambas as partes.
            </span>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="border-[#E4E2DC] text-[#666666] hover:bg-[#F7F5F0] text-xs font-semibold rounded-xl h-9 px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#0057FF] hover:bg-[#0047D4] text-white font-bold text-xs uppercase rounded-xl h-9 px-5 shadow-sm flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                </>
              ) : existingReview?.id ? (
                'Atualizar Avaliação'
              ) : (
                'Enviar Avaliação'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
