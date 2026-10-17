import type { Rng } from "@/lib/combat/damage";

/**
 * mulberry32：32 位元狀態、可序列化的 seeded PRNG。狀態就是下一步的內部整數（uint32），
 * 直接存進 IdleState.seed，引擎每次 advance 讀出、結束寫回。
 */
export function mulberry32Step(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** 實作 damage.ts 的 `Rng`，讓 playerHit 直接從存檔的種子抽籤。 */
export class SeededRng implements Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    const step = mulberry32Step(this.state);
    this.state = step.state;
    return step.value;
  }

  randrange(stop: number): number {
    return Math.floor(this.next() * stop);
  }

  randint(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}
