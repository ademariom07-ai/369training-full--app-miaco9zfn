import { expect, it } from 'vitest'
import { normalizeExerciseVideo as normalize } from './exerciseVideo'
const id='AbCdEf12_-3', canonical=`https://www.youtube.com/watch?v=${id}`
it.each([canonical,`https://youtu.be/${id}?si=tracking`,`https://m.youtube.com/watch?v=${id}&list=other`,`https://youtube.com/shorts/${id}`,`https://www.youtube.com/embed/${id}`])('canonicalizes supported video URL %s', url=>expect(normalize(url)).toBe(canonical))
it.each(['javascript:alert(1)','data:text/html,test','https://youtube.com.evil.test/watch?v='+id,'https://youtube.com@evil.test/watch?v='+id,'http://youtu.be/'+id,'https://www.youtube.com/redirect?q=evil','https://www.youtube.com/watch?v='+id+'&v=OtherId1234','https://youtu.be/short','https://www.youtube.com:8080/watch?v='+id,'https://www.youtube.com/watch?v='+id+'/path','',null])('rejects unsupported or unsafe URL %s', url=>expect(normalize(url)).toBeNull())
