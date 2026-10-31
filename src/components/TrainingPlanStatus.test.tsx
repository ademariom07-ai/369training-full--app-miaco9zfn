import {renderToStaticMarkup} from 'react-dom/server'
import {it,expect} from 'vitest'
import TrainingPlanStatus from './TrainingPlanStatus'
it('shows the persisted completion time rather than a new timestamp',()=>{
 const html=renderToStaticMarkup(<TrainingPlanStatus completion={{plan_id:'plan',student_id:'student',completed_at:'2026-10-31T01:00:00Z'}} historical={false} professional={false}/> )
 expect(html).toContain('2026-10-31T01:00:00Z');expect(html).toContain('30/10/2026');expect(html).toContain('22:00:00');expect(html).toContain('registrada pelo aluno')
})
it('preserves recorded completion in historical publications',()=>{
 expect(renderToStaticMarkup(<TrainingPlanStatus completion={{plan_id:'p',student_id:'s',completed_at:'2026-10-31T01:00:00Z'}} historical professional={false}/>)).toContain('Conclusão registrada')
})
it('distinguishes historical read-only from pending current execution',()=>{
 expect(renderToStaticMarkup(<TrainingPlanStatus historical professional={false}/>)).toContain('somente para consulta')
 expect(renderToStaticMarkup(<TrainingPlanStatus historical={false} professional={false}/>)).toContain('Execução ainda não registrada')
 expect(renderToStaticMarkup(<TrainingPlanStatus historical={false} professional/>)).toContain('Aguardando o aluno')
})
