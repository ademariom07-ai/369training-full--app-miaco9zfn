import type {TrainingCompletion} from '@/lib/supabase/trainingCompletions'
export default function TrainingPlanStatus({completion,historical,professional}:{completion?:TrainingCompletion;historical:boolean;professional:boolean}){
 if(completion)return <p className="rounded border border-lime-300 bg-lime-50 p-3" role="status">Conclusão registrada pelo aluno em <time dateTime={completion.completed_at}>{new Date(completion.completed_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</time> (horário de Brasília).</p>
 if(historical)return <p className="text-sm">Sem conclusão registrada nesta publicação. Histórico disponível somente para consulta.</p>
 return <p className="text-sm">{professional?'Aguardando o aluno registrar a conclusão.':'Execução ainda não registrada nesta publicação.'}</p>
}
