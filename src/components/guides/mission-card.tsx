import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, ScrollTextIcon } from "lucide-react";
import { getMissionDetail } from "@/lib/queries/missions";
import { getMissionLogic } from "@/lib/queries/mission-logic";
import { getGuideRef } from "@/lib/guide-refs";
import { GameText } from "@/components/common/game-text";
import { num, rewardView } from "@/components/common/reward-view";
import { NpcList, NpcPortrait } from "@/components/missions/npc-portrait";
import type { Reward } from "@/lib/types/mission-logic";
import { GuideRefTag } from "./guide-ref-tag";

// help 內嵌的 <map=…,LABEL> 取地名、<item,ID,QTY> 直接拿掉；FONT 色碼交給 GameText。
// ponytail: 摘要用，道具名不回查；要連結再改用 MissionStepText。
function plainHelp(help: string) {
  return help
    .replace(/<map=([^>]+)>/g, (_, inner: string) => inner.split(",map=")[0].split(",").at(-1) ?? "")
    .replace(/<item,\d+(?:,\d+)?>/g, "");
}

function RewardChip({ reward }: { reward: Reward }) {
  const isItem = (reward.type === "item" || reward.type === "timed_item") && reward.refId != null;
  const ref = isItem ? getGuideRef("item", reward.refId as number) : null;
  if (ref) {
    return (
      <GuideRefTag data={ref} variant="chip">
        {reward.qty != null && reward.qty !== 1 && (
          <span className="text-muted-foreground shrink-0 font-mono text-[12px]">×{num(reward.qty)}</span>
        )}
      </GuideRefTag>
    );
  }
  const v = rewardView(reward);
  return (
    <span className="bg-card inline-flex items-center gap-2 rounded-lg border border-border/60 py-1 pr-2.5 pl-1 text-[13.5px] leading-tight [&>span:first-child]:size-7">
      {v.lead}
      {v.label}
      {v.value && <span className="text-muted-foreground font-mono text-[12px]">{v.value}</span>}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5em_minmax(0,1fr)] items-center gap-x-3">
      <dt className="text-muted-foreground text-[12.5px]">{label}</dt>
      <dd className="text-[14px]">{children}</dd>
    </div>
  );
}

/**
 * 攻略內文用的任務卡：名稱、說明摘要、接取／交付 NPC、獎勵、前幾步對話。
 * steps：顯示前幾步有對話的流程（預設 2，0 = 不顯示）。查無任務回 null。
 */
export function MissionCard({ id, steps = 2 }: { id: number | string; steps?: number }) {
  const missionId = Number(id);
  if (!Number.isInteger(missionId) || missionId <= 0) return null;
  const mission = getMissionDetail(missionId);
  if (!mission?.name) return null;
  const logic = getMissionLogic(missionId);
  const images = logic.npcImages;

  const flow = logic.flow.filter((f) => f.dialogue && f.npcs.length > 0).slice(0, Math.max(0, steps));
  const keyNpcs = new Set([...logic.acceptNpcs, ...logic.completeNpcs]);
  const along = [...new Set(logic.flow.flatMap((f) => f.npcs))].filter((n) => !keyNpcs.has(n));

  return (
    <section className="bg-card my-6 overflow-hidden rounded-xl border">
      <div className="px-4 pt-4 pb-3.5 sm:px-5">
        <p className="font-heading flex items-center gap-1.5 text-[12.5px] tracking-[0.1em] text-(--stop-ink)">
          <ScrollTextIcon className="size-3.5" aria-hidden />
          任務
          <span className="text-muted-foreground font-mono text-[11.5px] tracking-normal">#{missionId}</span>
        </p>
        <h4 className="mt-1 text-[19px] leading-snug font-semibold">{mission.name}</h4>
        {mission.help && (
          <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed text-pretty">
            <GameText text={plainHelp(mission.help)} maxChars={80} />
          </p>
        )}
      </div>

      <dl className="flex flex-col gap-2.5 border-t border-dashed px-4 py-3.5 sm:px-5">
        {logic.acceptNpcs.length > 0 && (
          <Row label="接取">
            <NpcList names={logic.acceptNpcs} images={images} />
          </Row>
        )}
        {logic.completeNpcs.length > 0 && (
          <Row label="交付">
            <NpcList names={logic.completeNpcs} images={images} />
          </Row>
        )}
        {along.length > 0 && (
          <Row label="途中">
            <NpcList names={along} images={images} portraitClassName="size-7" />
          </Row>
        )}
        {logic.rewards.length > 0 && (
          <Row label="獎勵">
            <ul className="flex flex-wrap gap-1.5">
              {logic.rewards.map((r, i) => (
                <li key={i} className="max-w-full min-w-0">
                  <RewardChip reward={r} />
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>

      {flow.length > 0 && (
        <ol className="bg-muted/30 flex flex-col gap-3 border-t px-4 py-3.5 sm:px-5">
          {flow.map((f) => (
            <li key={f.step} className="flex gap-2.5">
              <NpcPortrait image={images[f.npcs[0]]} name={f.npcs[0]} className="size-8" />
              <div className="min-w-0 text-[13.5px] leading-relaxed">
                <p className="text-muted-foreground text-[12px]">
                  {f.step === 0 ? "接取時" : `第 ${f.step} 步`}・{f.npcs[0]}
                </p>
                <p>
                  「<GameText text={f.dialogue!} maxChars={60} />」
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Link
        href={`/missions/${missionId}`}
        className="group hover:bg-muted/60 focus-visible:ring-ring flex items-center justify-between border-t px-4 py-2.5 text-[13.5px] font-medium text-(--stop-ink) outline-none focus-visible:ring-2 focus-visible:ring-inset motion-safe:transition-colors sm:px-5"
      >
        看完整任務流程
        <ArrowRightIcon
          className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </section>
  );
}
