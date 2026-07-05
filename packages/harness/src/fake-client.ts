import type { ChatClient, ChatRequest, ChatResult } from './openrouter.js'

const FAKE_CAT = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 85">` +
  `<ellipse cx="50" cy="48" rx="30" ry="26" fill="${color}"/>` +
  `<path d="M24 32 L30 12 L42 28 Z" fill="${color}"/><path d="M58 28 L70 12 L76 32 Z" fill="${color}"/>` +
  `<circle cx="40" cy="44" r="4" fill="black"/><circle cx="60" cy="44" r="4" fill="black"/></svg>`

/** Deterministic offline client for tests and --dry-run. */
export class CannedClient implements ChatClient {
  async chat(req: ChatRequest): Promise<ChatResult> {
    const text = JSON.stringify(req.messages)
    if (text.includes('You are judging')) {
      return { content: '{"cat_likeness": 7, "aesthetic": 6, "technique": 8, "prompt_fidelity": 7}', finishReason: 'stop' }
    }
    // vary output per model so the dry-run leaderboard is not a tie
    const color = req.model.includes('gpt') ? 'orange' : 'gray'
    if (req.model.includes('refuser')) return { content: 'I cannot draw cats.', finishReason: 'stop' }
    return { content: `Here you go!\n\`\`\`svg\n${FAKE_CAT(color)}\n\`\`\``, finishReason: 'stop' }
  }
}
