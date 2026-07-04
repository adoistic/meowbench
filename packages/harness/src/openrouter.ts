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

export class OpenRouterClient implements ChatClient {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
    private opts: { baseUrl?: string; retryDelayMs?: number } = {},
  ) {}

  async chat(req: ChatRequest): Promise<string> {
    const url = `${this.opts.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`
    const delay = this.opts.retryDelayMs ?? 500
    let lastError = new Error('unreachable')
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
        return data.choices?.[0]?.message?.content ?? ''
      }
      lastError = new Error(`openrouter ${res.status}`)
      const retryable = res.status >= 500 || res.status === 429
      if (!retryable) throw lastError
      await new Promise((r) => setTimeout(r, delay * 2 ** attempt))
    }
    throw lastError
  }
}
