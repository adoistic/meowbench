export function mean(xs: number[]): number {
  if (xs.length === 0) throw new Error('mean of empty list')
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new Error('median of empty list')
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}
