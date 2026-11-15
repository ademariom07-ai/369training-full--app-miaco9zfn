'use strict';
// Generated from the tested React reminder core.
const ReminderCore=(()=>{
                                                                                                                        
function validateMinutes(value        )             {const n=typeof value==='string'&&value.trim()!==''?Number(value):value;return typeof n==='number'&&Number.isInteger(n)&&n>=5&&n<=120?n:null}
function createReminder(minutes=20)          {const n=validateMinutes(minutes);if(n===null)throw new RangeError('Escolha de 5 a 120 minutos.');return {minutes:n,phase:'idle',deadline:null,remaining:0}}
function startReminder(r         ,now=Date.now())          {if(!Number.isFinite(now))throw new RangeError('Relógio inválido.');const minutes=validateMinutes(r.minutes);if(minutes===null)throw new RangeError('Intervalo inválido.');const remaining=r.phase==='paused'&&Number.isFinite(r.remaining)&&r.remaining>0?Math.min(r.remaining,minutes*60):minutes*60;return {minutes,phase:'running',deadline:now+remaining*1000,remaining}}
function tickReminder(r         ,now=Date.now())          {if(r.phase!=='running')return r;if(!Number.isFinite(now)||r.deadline===null||!Number.isFinite(r.deadline))return createReminder(r.minutes);const remaining=Math.max(0,Math.ceil((r.deadline-now)/1000));return remaining===0?{...r,phase:'due',deadline:null,remaining:0}:{...r,remaining}}
function pauseReminder(r         ,now=Date.now())          {const next=tickReminder(r,now);return next.phase==='running'?{...next,phase:'paused',deadline:null}:next}
function stopReminder(r         )          {return createReminder(r.minutes)}
function formatRemaining(seconds       )        {const n=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}

return Object.freeze({validateMinutes,createReminder,startReminder,tickReminder,pauseReminder,stopReminder,formatRemaining});
})();
