import type { IdleState } from "@/lib/idle/types";
import type { LogContext, SceneFx } from "@/lib/idle/view";

export interface LogEntry {
  id: number;
  time: string;
  text: string;
  gain: string;
}

/** 瀏覽器端的遊戲執行狀態：每一幀都在變，所以放在 ref，只有低頻的快照才進 React state。 */
export interface Runtime {
  state: IdleState;
  /** 場景時間（ticks），與引擎前進的 ticks 同步。 */
  clock: number;
  /** 還沒湊成一個 tick 的毫秒。 */
  acc: number;
  last: number;
  /** 上次回報伺服器之後，引擎又跑了幾個 ticks。 */
  unsynced: number;
  fx: SceneFx;
  logCtx: LogContext;
  log: LogEntry[];
  logSeq: number;
  /** 擊倒的時間戳（毫秒），算每小時擊倒數。 */
  killTimes: number[];
  startedAt: number;
  sessionKills0: number;
  lastRate: number | null;
}
