type Plan = {student_id:string;professional_id:string;link_version:number}
type Link = {student_id:string;professional_id:string;version:number;state:string}

// A renewed relationship never reactivates a plan from an earlier version.
export function hasCurrentTrainingLink(plan:Plan, links:Link[]):boolean {
 return links.some(link=>link.state==='active'&&link.student_id===plan.student_id&&link.professional_id===plan.professional_id&&link.version===plan.link_version)
}
