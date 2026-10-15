/** Parse only an unambiguous duration; never choose a value from a range. */
export function parseWorkoutRest(value: string): number | null {
  const text = value.trim().toLowerCase()
  let seconds: number
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(text)
  const unit = /^(\d+(?:[.,]\d+)?)\s*(s|seg|segundo|segundos|min|minuto|minutos)$/.exec(text)
  if (clock) seconds = Number(clock[1]) * 60 + Number(clock[2])
  else if (unit) seconds = Number(unit[1].replace(',', '.')) * (unit[2].startsWith('min') ? 60 : 1)
  else return null
  return Number.isInteger(seconds) && seconds > 0 && seconds <= 3600 ? seconds : null
}
