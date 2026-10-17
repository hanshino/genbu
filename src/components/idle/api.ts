import type { IdleData, IdleState, IdleSummary } from "@/lib/idle/types";
import type { IdleSceneAssets } from "@/lib/queries/idle";

export interface IdleView {
  state: IdleState;
  offlineSummary?: IdleSummary;
  summary?: IdleSummary;
}

export type ApiResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; error: string; state?: IdleState };

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 非 JSON 的錯誤頁
  }
  if (res.ok) return { ok: true, body: body as T };
  const error = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "發生錯誤，請稍後再試。";
  const state = body && typeof body === "object" && "state" in body ? ((body as { state: IdleState }).state ?? undefined) : undefined;
  return { ok: false, status: res.status, error, state };
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    return await parse<T>(await fetch(url, { cache: "no-store", ...init }));
  } catch {
    return { ok: false, status: 0, error: "連不上伺服器，請稍後再試。" };
  }
}

export function getSave(): Promise<ApiResult<IdleView | { state: null }>> {
  return request("/api/idle");
}

export function postJson<T = IdleView>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 離開頁面時送出（keepalive 讓請求在頁面關掉後仍會送完）；不等回應。 */
export function postBeacon(url: string, body: unknown): void {
  try {
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // 頁面正在關閉，沒有補救空間；伺服器下次載入會依時間結算。
  }
}

export interface IdleBoot {
  data: IdleData;
  scene: IdleSceneAssets;
}

export function getIdleData(presetId: number): Promise<ApiResult<IdleBoot>> {
  return request(`/api/idle/data?preset=${presetId}`, { cache: "default" });
}
