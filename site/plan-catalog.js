'use strict';
// Generated from the historical plan reference catalog.
const PlanCatalog=(()=>{
                                               
                                                
                                                                                                                                                                                                                                  
// Historical reference values from plans_change and on_service_completed hooks.
// Not a live quote, subscription entitlement, gateway amount or accepted offer.
const ALL_PLANS                       = Object.freeze([
 { id: 'gratis', name: 'Grátis', roles: ['aluno', 'profissional'], studentMonthly: 0, studentAnnual: 0, professionalMonthly: 0, professionalAnnual: 0, professionalServiceFee: 1 },
 { id: 'basico', name: 'Básico', roles: ['aluno', 'profissional'], studentMonthly: 10, studentAnnual: 100, professionalMonthly: 0, professionalAnnual: 0, professionalServiceFee: 1 },
 { id: 'pro', name: 'Pro', roles: ['aluno', 'profissional'], studentMonthly: 20, studentAnnual: 200, professionalMonthly: 0, professionalAnnual: 0, professionalServiceFee: 2 },
 { id: 'premium', name: 'Premium', roles: ['aluno', 'profissional'], studentMonthly: 30, studentAnnual: 300, professionalMonthly: 0, professionalAnnual: 0, professionalServiceFee: 3 },
 { id: 'pro_parceiro', name: 'Pro Parceiro', roles: ['profissional'], studentMonthly: 0, studentAnnual: 0, professionalMonthly: 149, professionalAnnual: 1490, professionalServiceFee: 0 },
].map(p => Object.freeze({ ...p, roles: Object.freeze(p.roles              ) })))
function plansForRole(role         ) {
 return role === 'aluno' || role === 'profissional' ? ALL_PLANS.filter(p => p.roles.includes(role)) : []
}
function planReference(role         , id         , period         ) {
 if (period !== 'monthly' && period !== 'annual') return null
 const plan = plansForRole(role).find(p => p.id === id)
 if (!plan) return null
 return Object.freeze({ id: plan.id, name: plan.name, amount: role === 'aluno' ? (period === 'annual' ? plan.studentAnnual : plan.studentMonthly) : (period === 'annual' ? plan.professionalAnnual : plan.professionalMonthly), serviceFee: role === 'profissional' ? plan.professionalServiceFee : null, period })
}

return Object.freeze({ALL_PLANS,plansForRole,planReference});
})();
