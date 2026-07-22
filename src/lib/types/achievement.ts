export interface AchievementSubCat {
  id: number;
  name: string;
  count: number;
  totalPoints: number;
}

export interface AchievementCategory {
  id: number;
  name: string;
  subCats: AchievementSubCat[];
}

/** 解碼後的獎勵呈現;href 存在時渲染為連結。 */
export interface AchievementReward {
  label: string;
  href?: string;
}

export interface AchievementRow {
  id: number;
  subCatId: number;
  groupNo: number;
  name: string;
  description: string | null;
  points: number;
  resetType: number;
  rewardType: number;
  rewardId: number;
  rewardAmount: number;
  /** join items(type 2)/ magic(type 5)取得的獎勵名稱 */
  rewardName: string | null;
  /** 前置成就名(全表僅 8 筆非零) */
  prereqName: string | null;
}

/** 搜尋結果列:額外帶分類資訊 */
export interface AchievementSearchRow extends AchievementRow {
  subCatName: string;
  categoryName: string;
}
