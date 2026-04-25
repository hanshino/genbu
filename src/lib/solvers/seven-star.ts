export type SevenStarState = readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

export function solveSevenStar(n: number): SevenStarState {
  return [
    ((n >> 0) & 1) === 1,
    ((n >> 1) & 1) === 1,
    ((n >> 2) & 1) === 1,
    ((n >> 3) & 1) === 1,
    ((n >> 4) & 1) === 1,
    ((n >> 5) & 1) === 1,
    ((n >> 6) & 1) === 1,
  ] as const;
}

export function sevenStarToNumber(states: SevenStarState): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (states[i]) n |= 1 << i;
  }
  return n;
}
