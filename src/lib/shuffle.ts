/** Fisher–Yates shuffle. Returns a new array. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Shuffled index array `0..length-1`. */
export function shuffleIndices(length: number): number[] {
  return shuffle(Array.from({ length }, (_, i) => i))
}
