import { beforeEach, expect, it, vi } from 'vitest'
const { client } = vi.hoisted(() => ({
  client: { authStore: { record: { id: 'user-a' } as { id: string } | null }, send: vi.fn() },
}))
vi.mock('@/lib/pocketbase/client', () => ({ default: client }))
const result = {
  video: {
    id: 'AbCdEf12_-3',
    title: 'Agachamento',
    channel: 'Canal',
    url: 'https://www.youtube.com/watch?v=AbCdEf12_-3',
    checkedAt: '2026-10-16',
  },
  message: 'Sugestão',
}
beforeEach(() => {
  vi.resetModules()
  client.send.mockReset()
  client.authStore.record = { id: 'user-a' }
})
it('deduplicates the same exercise and sends only the exercise label', async () => {
  client.send.mockResolvedValue(result)
  const { searchExerciseVideo } = await import('./exerciseVideoSearch')
  const [a, b] = await Promise.all([
    searchExerciseVideo(' Agachamento  com halteres '),
    searchExerciseVideo('Agachamento com halteres'),
  ])
  expect(a).toEqual(b)
  expect(client.send).toHaveBeenCalledTimes(1)
  expect(client.send.mock.calls[0][1].body).toEqual({ exercise: 'Agachamento com halteres' })
})
it('serializes different exercises', async () => {
  let finish: (value: unknown) => void = () => {}
  client.send
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue(result)
  const { searchExerciseVideo } = await import('./exerciseVideoSearch')
  const first = searchExerciseVideo('Agachamento'),
    second = searchExerciseVideo('Supino')
  await vi.waitFor(() => expect(client.send).toHaveBeenCalledTimes(1))
  finish(result)
  await Promise.all([first, second])
  expect(client.send).toHaveBeenCalledTimes(2)
})
it('does not reuse a cached result for another account', async () => {
  client.send.mockResolvedValue(result)
  const { searchExerciseVideo } = await import('./exerciseVideoSearch')
  await searchExerciseVideo('Agachamento')
  client.authStore.record = { id: 'user-b' }
  await searchExerciseVideo('Agachamento')
  expect(client.send).toHaveBeenCalledTimes(2)
})
it('rejects unsafe result URLs and allows retry after an error', async () => {
  client.send
    .mockResolvedValueOnce({ ...result, video: { ...result.video, url: 'https://evil.test' } })
    .mockResolvedValue(result)
  const { searchExerciseVideo } = await import('./exerciseVideoSearch')
  await expect(searchExerciseVideo('Agachamento')).rejects.toThrow('inválida')
  await expect(searchExerciseVideo('Agachamento')).resolves.toEqual(result)
})
it('rejects missing authentication and invalid input before sending', async () => {
  const { searchExerciseVideo } = await import('./exerciseVideoSearch')
  await expect(searchExerciseVideo('')).rejects.toThrow()
  client.authStore.record = null
  await expect(searchExerciseVideo('Agachamento')).rejects.toThrow()
  expect(client.send).not.toHaveBeenCalled()
})
