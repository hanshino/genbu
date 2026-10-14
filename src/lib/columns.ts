// 列表頁「顯示欄位」的共用邏輯（/skills、/items、/monsters）。
// 每頁只提供自己的欄位定義：基本欄位（預設顯示）+ 數值欄位（預設隱藏）。名稱欄固定顯示，不列入。
// URL `?cols=a,b` 為準（可分享），沒有就看 cookie（上次的選擇），再沒有用預設。

export interface ColumnDef<K extends string = string> {
  readonly key: K;
  readonly label: string;
}

export interface ColumnSet<B extends ColumnDef = ColumnDef, N extends ColumnDef = ColumnDef> {
  readonly cookie: string;
  readonly base: readonly B[];
  readonly numeric: readonly N[];
  /** 依定義順序的全部 key；parse 結果也照這個順序。 */
  readonly keys: readonly (B["key"] | N["key"])[];
  readonly defaults: readonly (B["key"] | N["key"])[];
  /** picker 底部的說明文字。 */
  readonly note?: string;
}

export type ColumnKey<S extends ColumnSet> = S["keys"][number];

export function defineColumnSet<const B extends ColumnDef, const N extends ColumnDef>(opts: {
  cookie: string;
  base: readonly B[];
  numeric: readonly N[];
  note?: string;
}): ColumnSet<B, N> {
  const defaults = opts.base.map((c) => c.key);
  return { ...opts, keys: [...defaults, ...opts.numeric.map((c) => c.key)], defaults };
}

/** 逗號分隔字串 → 依定義順序排好的欄位；不認得的 key 略過，一個都沒有回 null（交給下一層 fallback）。 */
export function parseColumns<S extends ColumnSet>(
  set: S,
  raw: string | undefined | null,
): ColumnKey<S>[] | null {
  if (!raw) return null;
  const wanted = new Set(raw.split(","));
  const cols = set.keys.filter((k) => wanted.has(k));
  return cols.length > 0 ? cols : null;
}

export function isDefaultColumns(set: ColumnSet, cols: readonly string[]): boolean {
  return cols.length === set.defaults.length && set.defaults.every((k) => cols.includes(k));
}

/** URL > cookie > 預設。 */
export function resolveColumns<S extends ColumnSet>(
  set: S,
  urlRaw: string | undefined,
  cookieRaw: string | undefined,
): readonly ColumnKey<S>[] {
  return parseColumns(set, urlRaw) ?? parseColumns(set, cookieRaw) ?? set.defaults;
}
