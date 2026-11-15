'use strict';
const ExerciseMedia=(()=>{
// No provider credentials or unverified exercise-name matching in the client.
function safeExerciseGif(value        )             {
 if(typeof value!=='string'||value.length>2048)return null
 try{const u=new URL(value.trim()),h=u.hostname.toLowerCase()
  if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h.endsWith('.')||h.includes(':')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||/\.(local|internal|localhost|test)$/.test(h)||!u.pathname.toLowerCase().endsWith('.gif'))return null
  return u.href
 }catch{return null}
}
async function fetchExerciseGif(name        ,catalog                                ={})                     {
 if(typeof name!=='string'||!name.trim()||name.length>100||['__proto__','constructor','prototype'].includes(name))return null
 return Object.hasOwn(catalog,name)?safeExerciseGif(catalog[name]):null
}

return Object.freeze({safeExerciseGif,fetchExerciseGif});
})();
