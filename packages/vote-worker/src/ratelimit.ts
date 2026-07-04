export const MAX_VOTES_PER_MINUTE = 10
const WINDOW_MS = 60_000

/** True if this ip_hash has made fewer than MAX_VOTES_PER_MINUTE votes in the last 60s. */
export async function underRateLimit(db: D1Database, ipHash: string, now: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ? AND ts > ?')
    .bind(ipHash, now - WINDOW_MS)
    .first<{ n: number }>()
  return (row?.n ?? 0) < MAX_VOTES_PER_MINUTE
}
