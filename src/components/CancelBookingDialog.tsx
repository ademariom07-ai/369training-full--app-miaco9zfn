import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog'

export default function CancelBookingDialog({startsAt,disabled,onConfirm}:{startsAt:string;disabled:boolean;onConfirm:()=>Promise<void>}){
 const [open,setOpen]=useState(false)
 const when=new Date(startsAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'full',timeStyle:'short'})
 return <AlertDialog open={open} onOpenChange={next=>{if(!disabled)setOpen(next)}}>
  <AlertDialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}>Cancelar reserva temporária</Button></AlertDialogTrigger>
  <AlertDialogContent className="w-[calc(100%-2rem)] border-[#7f8091]/30 bg-[#f7f6f2] text-[#33325a]">
   <AlertDialogHeader><AlertDialogTitle>Cancelar este horário?</AlertDialogTitle>
    <AlertDialogDescription className="space-y-3 text-[#33325a]" asChild><div>
     <p className="rounded-[8px_16px_8px_16px] bg-[#a5ce41]/20 p-3 font-medium">{when} — Brasília</p>
     <p>A reserva temporária será encerrada e o horário poderá ficar disponível novamente.</p>
     <p className="text-sm">Este atendimento ainda não foi confirmado. O piloto não realiza cobranças nem estornos.</p>
    </div></AlertDialogDescription>
   </AlertDialogHeader>
   <AlertDialogFooter className="gap-2">
    <AlertDialogCancel disabled={disabled}>Manter reserva</AlertDialogCancel>
    <Button type="button" disabled={disabled} onClick={async()=>{await onConfirm();setOpen(false)}}>{disabled?'Verificando…':'Confirmar cancelamento'}</Button>
   </AlertDialogFooter>
  </AlertDialogContent>
 </AlertDialog>
}
