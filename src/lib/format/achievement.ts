import { REWARD_CURRENCY_NAMES } from "@/lib/constants/achievement";
import type { AchievementReward, AchievementRow } from "@/lib/types/achievement";

/**
 * 解碼成就獎勵欄位為可呈現的文字/連結。
 * reward_type:0=無獎勵、1=貨幣、2=道具、3=銀兩、5=永久屬性加成(magic)。
 * 未知 type 保底顯示原始編號,不擲錯。
 */
export function formatReward(
  row: Pick<AchievementRow, "rewardType" | "rewardId" | "rewardAmount" | "rewardName">,
): AchievementReward | null {
  const { rewardType, rewardId, rewardAmount, rewardName } = row;
  const amount = rewardAmount.toLocaleString("zh-TW");
  switch (rewardType) {
    case 0:
      return null;
    case 1:
      return { label: `${REWARD_CURRENCY_NAMES[rewardId] ?? `貨幣 #${rewardId}`} ×${amount}` };
    case 2:
      return { label: `${rewardName ?? `#${rewardId}`} ×${amount}`, href: `/items/${rewardId}` };
    case 3:
      return { label: `銀兩 ×${amount}` };
    case 5:
      return { label: rewardName ?? `#${rewardId}`, href: `/skills/${rewardId}` };
    default:
      return { label: `獎勵 #${rewardType}（#${rewardId} ×${rewardAmount}）` };
  }
}
