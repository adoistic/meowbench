export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user'
  content: string | ContentPart[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface ChatClient {
  chat(req: ChatRequest): Promise<string>
}

const MAX_RETRIES = 2

interface ChatResponseBody {
  choices?: { message?: { content?: string } }[]
  error?: unknown
}

export class OpenRouterClient implements ChatClient {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
    private opts: { baseUrl?: string; retryDelayMs?: number; timeoutMs?: number } = {},
  ) {}

  async chat(req: ChatRequest): Promise<string> {
    const url = `${this.opts.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`
    const delay = this.opts.retryDelayMs ?? 500
    let lastError = new Error('unreachable')
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const backoff = () => new Promise((r) => setTimeout(r, delay * 2 ** attempt))
      let res: Response
      try {
        res = await this.fetchImpl(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens,
          }),
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 240_000),
        })
      } catch (err) {
        // transport failure (DNS, ECONNRESET, timeout abort) — retryable
        lastError = err instanceof Error ? err : new Error(String(err))
        await backoff()
        continue
      }
      if (res.ok) {
        let data: ChatResponseBody
        try {
          data = (await res.json()) as ChatResponseBody
        } catch (err) {
          // malformed body on a 200 (e.g. truncated proxy response) — retryable
          lastError = err instanceof Error ? err : new Error(String(err))
          await backoff()
          continue
        }
        if (data.error !== undefined) {
          // OpenRouter can return 200 with an error object and no choices — not retryable
          throw new Error(`openrouter error: ${JSON.stringify(data.error)}`)
        }
        return data.choices?.[0]?.message?.content ?? ''
      }
      lastError = new Error(`openrouter ${res.status}`)
      const retryable = res.status >= 500 || res.status === 429
      if (!retryable) throw lastError
      await backoff()
    }
    throw lastError
  }
}
