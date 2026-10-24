import type {ParticipantLink} from './participantLinks'
export type TrainingReview={professionalId:string;link:ParticipantLink;title:string;content:string}
export function prepareTrainingReview(professionalId:string,link:ParticipantLink,title:string,content:string):TrainingReview {
 if(link.state!=='active'||link.professional_id!==professionalId||!link.participant_name?.trim()||!Number.isSafeInteger(link.version)||link.version<1)throw Error('Atualize o vínculo antes de revisar.')
 if(!title.trim()||title.trim().length>120||!content.trim()||content.trim().length>6000)throw Error('Confira o título e as orientações.')
 return {professionalId,link:{...link},title:title.trim(),content:content.trim()}
}
export function isTrainingReviewCurrent(review:TrainingReview,professionalId:string,link:ParticipantLink|undefined,title:string,content:string):boolean {
 return !!link&&review.professionalId===professionalId&&link.professional_id===professionalId&&link.state==='active'&&link.student_id===review.link.student_id&&link.version===review.link.version&&link.participant_name===review.link.participant_name&&title.trim()===review.title&&content.trim()===review.content
}
