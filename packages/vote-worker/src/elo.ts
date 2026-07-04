export const START_RATING = 1500
export const K_FACTOR = 32

/** Probability that a player rated `a` beats a player rated `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400))
}

/** New ratings after `winnerRating` beats `loserRating`. Zero-sum, K=32. */
export function updateRatings(
  winnerRating: number,
  loserRating: number,
): { winner: number; loser: number } {
  const expWinner = expectedScore(winnerRating, loserRating)
  const delta = K_FACTOR * (1 - expWinner)
  return { winner: winnerRating + delta, loser: loserRating - delta }
}
