import { expect, test, vi } from 'vitest'
import { OpenRouterClient } from '../src/openrouter.js'

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

test('returns message content on success', async () => {
  const fetchImpl = fetchReturning(200, { choices: [{ message: { content: '<svg/>' } }] })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch)
  const out = await client.chat({ model: 'x/y', messages: [{ role: 'user', content: 'cat' }] })
  expect(out).toBe('<svg/>')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toContain('/chat/completions')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key')
})

test('retries twice on 5xx then succeeds', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    .mockResolvedValueOnce(new Response('boom', { status: 502 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  expect(await client.chat({ model: 'x/y', messages: [] })).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('does not retry 4xx client errors', async () => {
  const fetchImpl = fetchReturning(400, { error: 'bad' })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('openrouter 400')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})
