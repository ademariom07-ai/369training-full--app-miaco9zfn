export function buildWorkoutDraftRequest(input:{objective:string;experience:string;days:string;age:string;restrictions:string;equipment:string;reviewedAnamnesis:boolean}){
 if(input.reviewedAnamnesis!==true)throw Error('Confira a anamnese antes de gerar o rascunho.')
 const objective=input.objective.trim(),restrictions=input.restrictions.trim(),equipment=input.equipment.trim()
 if(!objective||objective.length>120||!restrictions||restrictions.length>2000||!equipment||equipment.length>500)throw Error('Informe objetivo, restrições e equipamentos. Dado ausente não significa ausência de restrição.')
 if(!['Iniciante','Intermediário','Avançado'].includes(input.experience))throw Error('Selecione a experiência.')
 if(!/^[1-7]$/.test(input.days))throw Error('Informe de 1 a 7 dias por semana.')
 if(!/^\d{1,3}$/.test(input.age)||Number(input.age)>120)throw Error('Informe a idade em anos.')
 if(Number(input.age)<18)throw Error('Geração para menores aguarda o fluxo verificado de responsável e revisão específica.')
 return {objective,experience:input.experience,daysAvailable:Number(input.days),restrictions,age:Number(input.age),equipment,reviewedAnamnesis:true as const,notes:`Idade: ${Number(input.age)} anos. Equipamentos: ${equipment}. Gere somente um rascunho sujeito à revisão profissional; não considere ausência de dados como liberação clínica.`}
}
