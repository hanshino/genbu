import type { JobChoice } from "@/lib/idle/job";
import type { IdleData, IdleState, IdleSummary } from "@/lib/idle/types";
import type { IdleCreateAssets, IdleSceneAssets } from "@/lib/queries/idle";

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

/**
 * 公開資料 API 會被瀏覽器與 CDN 快取一小時以上；回傳格式一改就把版本加一，換網址避開舊快取。
 * 伺服器不看這個參數。
 */
const STATIC_DATA_VERSION = 3;

export function getIdleData(presetId: number, weaponItemId?: number): Promise<ApiResult<IdleBoot>> {
  const weapon = weaponItemId == null ? "" : `&weapon=${weaponItemId}`;
  return request(`/api/idle/data?preset=${presetId}${weapon}&v=${STATIC_DATA_VERSION}`, { cache: "default" });
}

export function getJobs(gender: "m" | "f"): Promise<ApiResult<{ jobs: JobChoice[] }>> {
  return request(`/api/idle/jobs?gender=${gender}&v=${STATIC_DATA_VERSION}`, { cache: "default" });
}

/** 建立角色畫面用的遊戲視窗版面與紙娃娃動作圖（公開資料，可以快取）。 */
export function getCreateAssets(): Promise<ApiResult<IdleCreateAssets>> {
  return request(`/api/idle/create-window?v=${STATIC_DATA_VERSION}`, { cache: "default" });
}
