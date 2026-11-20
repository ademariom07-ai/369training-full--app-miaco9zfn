import {describe,it,expect} from 'vitest'
import {applyOverrides,findLibraryEntry,resolveExercise,saveExercise,type LibraryExercise} from './exerciseLibrary'
import {exerciseAnimations} from '@/lib/exerciseAnimations'

const base:LibraryExercise={exercise_id:'11111111-1111-4111-8111-111111111111',slug:'agachamento-livre',owner_id:null,owner_name:null,name:'Agachamento livre',aliases:['agacho'],muscles:'Pernas',instructions:null,phase_cues:[{cues:['Dica editada']}],video:null,level:'iniciante',equipment:null,official:true,mine:false}
const own:LibraryExercise={...base,exercise_id:'22222222-2222-4222-8222-222222222222',slug:null,owner_id:'x',owner_name:'Ana',name:'Step da Ana',aliases:[],instructions:'Suba e desça do step.',phase_cues:null,video:'dQw4w9WgXcQ',official:false,mine:false}

describe('biblioteca de exercícios no banco',()=>{
 it('textos editados pelo admin entram na animação; fases sem edição mantêm o padrão',()=>{
  const anim=exerciseAnimations.find(a=>a.id==='agachamento-livre')!
  const merged=applyOverrides(anim,base)
  expect(merged.phases[0].cues).toEqual(['Dica editada']);expect(merged.phases[1].cues).toEqual(anim.phases[1].cues);expect(merged.muscles).toBe('Pernas')
 })
 it('reconhece pelo outro nome cadastrado e resolve a animação pelo slug',()=>{
  expect(findLibraryEntry('AGACHO',[base])?.slug).toBe('agachamento-livre')
  expect(resolveExercise('agacho',[base]).animation?.id).toBe('agachamento-livre')
 })
 it('exercício próprio sem animação traz texto e vídeo',()=>{
  const r=resolveExercise('Step da Ana',[own]);expect(r.animation).toBeNull();expect(r.entry?.video).toBe('dQw4w9WgXcQ')
 })
 it('sem biblioteca carregada, os 30 continuam animados pelo nome',()=>{
  expect(resolveExercise('Prancha',[]).animation?.id).toBe('prancha')
 })
 it('validações antes do servidor',async()=>{
  const input={id:null,name:'Ok',aliases:'',muscles:'',instructions:'',phaseCues:null,video:'',level:'',equipment:''}
  await expect(saveExercise(input,{} as never)).rejects.toThrow('nome')
  await expect(saveExercise({...input,name:'Polichinelo',video:'https://vimeo.com/1'},{} as never)).rejects.toThrow('YouTube')
  await expect(saveExercise({...input,name:'Polichinelo',phaseCues:[['']]},{} as never)).rejects.toThrow('dicas')
 })
})
