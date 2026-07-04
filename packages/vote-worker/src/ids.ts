export interface ParsedSampleId {
  modelSlug: string
  promptId: string
  sample: number
}

/** Parse a "<modelSlug>|<promptId>|<sample>" id; null if malformed. */
export function parseSampleId(id: string): ParsedSampleId | null {
  const parts = id.split('|')
  if (parts.length !== 3) return null
  const [modelSlug, promptId, sampleStr] = parts
  if (!modelSlug || !promptId) return null
  const sample = Number(sampleStr)
  if (!Number.isInteger(sample) || sample < 1) return null
  return { modelSlug, promptId, sample }
}

/** SHA-256(ip + salt) as lowercase hex — never store the raw IP. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(ip + salt)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
