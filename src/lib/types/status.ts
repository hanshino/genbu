// status table row（對應 E:\SETTING\STATUS.INI 的每筆狀態細項）
// 由 magic.extra_status 引用，形成「技能 → 給予的狀態細項」關聯。

export interface Status {
  id: number;
  group: number | null;
  order: number | null;
  name: string;
  param1: number | null;
  param2: number | null;
  param3: number | null;
  param4: number | null;
  param5: number | null;
}
