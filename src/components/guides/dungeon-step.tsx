import type { ReactNode } from "react";
import { FlagIcon } from "lucide-react";
import { headingId } from "@/lib/guides";
import type { Crop, StepGroupInput, StepMarkInput, StepWalkInput } from "@/lib/guide-steps";
import { getStepData } from "@/lib/guide-steps.server";
import { StepProvider } from "./step-map";

interface DungeonStepProps {
  n: number | string;
  title: string;
  /** 地圖名後面的補充，例如「上方區域」。 */
  subtitle?: string;
  stage: number | string;
  crop?: Crop;
  groups?: StepGroupInput[];
  marks?: StepMarkInput[];
  /** 可行走通道：每條給通道內一點，地圖會畫出整條通道範圍。 */
  walk?: StepWalkInput[];
  children?: ReactNode;
}

/**
 * 迷宮攻略的一個步驟：印章編號、標題（進目錄）、地圖名／目標數／要求命中。
 * 內文可放 <StepMap/>、<StepTargets/>、<NineRoomGrid/>、<StepDone/>，它們共用同一份資料。
 */
export function DungeonStep({
  n,
  title,
  subtitle,
  stage,
  crop,
  groups,
  marks,
  walk,
  children,
}: DungeonStepProps) {
  const data = getStepData({ stage: Number(stage), crop, groups, marks, walk });
  const seal = String(n).padStart(2, "0");
  const kinds = data.groups.reduce((s, g) => s + g.rows.length, 0);
  const dev = process.env.NODE_ENV !== "production";
  const lostWalk = (walk ?? []).flatMap((w) => {
    const c = data.walk?.find((o) => o.label === w.label);
    if (!c) return [w.label];
    return [
      ...(c.portal ? [] : [`${w.label}傳點`]),
      ...(w.landing && !c.landing ? [`${w.label}落點`] : []),
    ];
  });

  return (
    <section className="bg-card my-8 overflow-hidden rounded-xl border">
      <header className="bg-muted/40 flex items-start gap-3 border-b px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className="font-heading grid size-9 shrink-0 place-items-center rounded-md bg-(--stop) text-[14px] font-semibold tracking-[0.04em] text-white shadow-[inset_0_0_0_2px_rgb(255_255_255/0.22)]"
        >
          {seal}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={headingId(title)}
            className="scroll-mt-20 text-[19px] leading-snug font-semibold text-balance sm:text-[21px]"
          >
            <span className="sr-only">{seal} · </span>
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
            <span>
              {data.stageName}
              {subtitle && ` · ${subtitle}`}
            </span>
            {kinds > 0 && <span>目標 {kinds} 種</span>}
            {data.hit && (
              <span>
                要求命中{" "}
                <span className="font-mono text-(--stop-ink)">
                  ＞{data.hit.dodge.toLocaleString("zh-TW")}
                </span>
              </span>
            )}
          </p>
        </div>
      </header>
      <div className="px-4 pt-4 pb-5 sm:px-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {dev && data.missing.length > 0 && (
          <p className="text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2 text-[12px]">
            待作者核對：這些 id 查無資料或不在區塊內：{data.missing.join("、")}
          </p>
        )}
        {dev && lostWalk.length > 0 && (
          <p className="text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2 text-[12px]">
            待作者核對：這些通道或標記畫不出來（查無可行走資料、傳點不可走、和前一條相通、不在區塊內，或落點不在同一條通道）：
            {lostWalk.join("、")}
          </p>
        )}
        <StepProvider data={data}>{children}</StepProvider>
      </div>
    </section>
  );
}

/** 步驟卡底部的完成條件，放在 <DungeonStep> 最後。 */
export function StepDone({ children }: { children?: ReactNode }) {
  return (
    <div className="mt-5 -mx-4 -mb-5 flex gap-2.5 border-t bg-(--stop)/6 px-4 py-3.5 text-[14.5px] leading-[1.7] sm:-mx-5 sm:px-5 [&_p]:mb-0 [&_p]:text-[14.5px] [&_p]:leading-[1.7]">
      <FlagIcon className="mt-1 size-4 shrink-0 text-(--stop-ink)" aria-hidden />
      <div className="min-w-0 [&>p:first-of-type]:inline">
        <b className="font-medium text-(--stop-ink)">完成條件：</b>
        {children}
      </div>
    </div>
  );
}
