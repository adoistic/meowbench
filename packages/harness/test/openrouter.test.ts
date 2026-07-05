import { expect, test, vi } from 'vitest'
import { OpenRouterClient } from '../src/openrouter.js'

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

test('returns message content on success', async () => {
  const fetchImpl = fetchReturning(200, { choices: [{ message: { content: '<svg/>' } }] })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch)
  const out = await client.chat({ model: 'x/y', messages: [{ role: 'user', content: 'cat' }] })
  expect(out.content).toBe('<svg/>')
  expect(out.finishReason).toBeUndefined()
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
  expect((await client.chat({ model: 'x/y', messages: [] })).content).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('does not retry 4xx client errors', async () => {
  const fetchImpl = fetchReturning(400, { error: 'bad' })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('openrouter 400')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

test('retries transport rejections then succeeds', async () => {
  const fetchImpl = vi
    .fn()
    .mockRejectedValueOnce(new Error('ECONNRESET'))
    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  expect((await client.chat({ model: 'x/y', messages: [] })).content).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('gives up after exhausting transport retries', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('ECONNRESET')
  expect(fetchImpl).toHaveBeenCalledTimes(3) // 1 + MAX_RETRIES
})

test('throws on 200 body carrying an error object', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'upstream sad' } }), { status: 200 }))
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('openrouter error')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

test('retries malformed 200 bodies', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response('not json{', { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  expect((await client.chat({ model: 'x/y', messages: [] })).content).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('captures finish_reason from the response', async () => {
  const fetchImpl = fetchReturning(200, { choices: [{ message: { content: '<svg/>' }, finish_reason: 'length' }] })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch)
  const out = await client.chat({ model: 'x/y', messages: [] })
  expect(out.content).toBe('<svg/>')
  expect(out.finishReason).toBe('length')
})

test('retries empty content then succeeds', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '  ' } }] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), { status: 200 }))
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  const out = await client.chat({ model: 'x/y', messages: [] })
  expect(out.content).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('throws after exhausting empty-content retries', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }))
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('empty content')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})
