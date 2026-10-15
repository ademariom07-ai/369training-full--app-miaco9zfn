import { expect, it } from 'vitest'
import { parseWorkoutRest } from './workoutRest'
it.each([['60s',60],['90 segundos',90],['1,5 min',90],['02:30',150],[' 2 minutos ',120]])('recognizes unambiguous rest %s', (text, expected) => expect(parseWorkoutRest(String(text))).toBe(expected))
it.each(['60–90s','1-2 minutos','até recuperar','90','01:90','0s','-30s','4000s','1h',''])('does not invent duration from %s', text => expect(parseWorkoutRest(text)).toBeNull())
