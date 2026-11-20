import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {writeFileSync} from 'node:fs'
import ExerciseAnimationView from './components/ExerciseAnimationView'
import {exerciseAnimations} from './lib/exerciseAnimations'
const out=process.argv[2],from=Number(process.argv[3]||0),to=Number(process.argv[4]||99)
let html='<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff;font:14px sans-serif">'
for(const ex of exerciseAnimations.slice(from,to)){
 const ends=ex.phases.reduce((a:number[],p)=>[...a,(a[a.length-1]??0)+p.seconds],[]).map(t=>t-0.01)
 const times=[0,...ends].slice(0,4)
 html+=`<div style="display:flex;gap:6px;padding:4px;align-items:center"><b style="width:120px">${ex.id}</b>`+times.map(t=>`<div style="width:220px">${renderToStaticMarkup(<ExerciseAnimationView exercise={ex} time={t} showText={false}/>)}</div>`).join('')+'</div>'
}
writeFileSync(out,html+'</body>')
