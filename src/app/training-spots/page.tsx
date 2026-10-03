import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronDownIcon,
  DatabaseIcon,
  InfoIcon,
  MapIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SchoolSelect } from "@/components/monsters/school-select";
import { TrainingSpotCard } from "@/components/maps/training-spot-card";
import { EliteFilterSwitch, TrainingSortToggle } from "@/components/maps/training-spot-controls";
import {
  TRAINING_LEVEL_RADIUS,
  getTrainingSpots,
  parseTrainingLevel,
} from "@/lib/queries/monster-spawns";
import { classifyTrainingStage, type TrainingStageCategory } from "@/lib/queries/training-classify";
import { getTrainingDropData } from "@/lib/queries/training-drops";
import { getSkillHitInfoBatch } from "@/lib/queries/magic";
import { SKILL_PICKS, type SkillSchool } from "@/lib/constants/skill-picks";
import {
  aggregateSpotDrops,
  mergeTrainingVariants,
  parseTrainingSort,
  sortTrainingSpots,
  spotHit,
  type TrainingSpotView,
} from "@/lib/training-spots";
import { MAX_MONSTER_LEVEL, MIN_MONSTER_LEVEL } from "@/lib/constants/monster-level";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "練功地圖 · 玄武",
  description: "輸入等級和門派，找適合你的野外練功地圖：需撐命中、菁英怪與掉落物",
  alternates: { canonical: "/training-spots" },
};

interface PageProps {
  searchParams: Promise<{ level?: string; school?: string; elite?: string; sort?: string }>;
}

const DEFAULT_SCHOOL: SkillSchool = "刀法";

function resolveSchool(raw: string | undefined): SkillSchool {
  if (raw && raw in SKILL_PICKS) return raw as SkillSchool;
  return DEFAULT_SCHOOL;
}

/** 其他地圖（不列入主列表）的分組標題，依顯示順序。 */
const OTHER_GROUPS: ReadonlyArray<{ category: TrainingStageCategory; label: string }> = [
  { category: "npc-only", label: "需要找 NPC 傳送（副本／任務）" },
  { category: "excluded", label: "副本（手動排除）" },
  { category: "pet", label: "寵物練功場" },
  { category: "story", label: "劇情、試煉、測試用地圖" },
  { category: "se", label: "特殊地圖（莊園、迷境等）" },
];

function windowOf(level: number) {
  return {
    min: Math.max(MIN_MONSTER_LEVEL, level - TRAINING_LEVEL_RADIUS),
    max: Math.min(MAX_MONSTER_LEVEL, level + TRAINING_LEVEL_RADIUS),
  };
}

function SourceBlock() {
  const rows: Array<[string, React.ReactNode]> = [
    ["來源等級", "資料庫（database）"],
    [
      "使用資料表",
      <span key="tables" className="font-mono text-[0.7rem] text-foreground">
        monster_spawns · stages · map_warps · npc · monsters · magic
      </span>,
    ],
    [
      "方法",
      <>
        怪物等級落在玩家等級 <b className="font-mono font-medium text-foreground">±5</b>
        （上下界含端點、clamp 到
        1–200）。此為本站以資料庫欄位推導的比對規則，非官方數值，也未經實機驗證。
      </>,
    ],
    [
      "野外地圖",
      "從城鎮出發，只沿著走過去就會觸發的傳送點能到的地圖。要找 NPC 傳送才進得去的副本、任務地圖，以及寵物練功場、劇情用地圖收在「其他地圖」。",
    ],
    ["菁英", "HP 是同張地圖其他怪物中位數的 10 倍以上，只是數字比較，不是遊戲裡的首領設定。"],
    [
      "需撐命中",
      "取一般怪中最高的閃躲，套用怪物頁同一條公式：閃躲 × 100 ÷ 招式命中參數，範圍為該門派最好中與最難中的招式。",
    ],
    ["限制", "不含劇情觸發或腳本生成的怪物；不代表官方推薦、進入保證或實際經驗效率。"],
    ["資料庫版本", "未標記"],
  ];

  return (
    <section
      aria-labelledby="sources-heading"
      className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <h2
        id="sources-heading"
        className="mb-3 flex items-center gap-2 border-b border-border/60 pb-3 text-sm font-medium"
      >
        <DatabaseIcon className="size-4 text-muted-foreground" aria-hidden />
        資料來源與方法
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3.5 gap-y-2 text-xs leading-relaxed">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
            <dd className="text-muted-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InitialState() {
  return (
    <section className="flex flex-col items-start gap-2.5 rounded-xl border border-dashed border-border bg-card px-4 py-6">
      <span className="grid size-9 place-items-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground">
        <MapIcon className="size-5" aria-hidden />
      </span>
      <h2 className="font-heading text-base font-semibold">還沒有查詢結果</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        輸入等級後，這裡會列出適合你練功的野外地圖：要撐多少命中、有哪些怪、會掉什麼。
      </p>
      <ol className="mt-1 flex w-full flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
        {[
          `填入等級（${MIN_MONSTER_LEVEL}–${MAX_MONSTER_LEVEL}）`,
          `取出怪物等級在 ±${TRAINING_LEVEL_RADIUS} 區間內的刷怪點`,
          "排除副本、任務地圖，依刷怪點數列出野外地圖",
        ].map((step, i) => (
          <li key={step} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded border border-border/60 font-mono text-[0.65rem] text-primary"
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OtherMaps({ spots }: { spots: TrainingSpotView[] }) {
  if (spots.length === 0) return null;
  return (
    <Collapsible className="rounded-xl border border-dashed border-border bg-card">
      <CollapsibleTrigger className="group flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted/50">
        <ChevronDownIcon
          className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden
        />
        其他地圖 <b className="font-mono text-primary">{spots.length}</b> 張
        <span className="text-xs font-normal text-muted-foreground">
          副本、任務、寵物練功場等，不列入上方結果
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
          {OTHER_GROUPS.map(({ category, label }) => {
            const list = spots.filter((s) => s.category === category);
            if (list.length === 0) return null;
            return (
              <div key={category} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <Badge
                      key={`${s.stageKind}:${s.stageId}`}
                      variant="outline"
                      render={<Link href={`/maps/${s.stageId}`} />}
                      className="h-6 rounded-full px-2.5 font-normal hover:bg-muted/50"
                    >
                      {s.stageName}
                      <span className="font-mono text-[0.65rem] text-muted-foreground">
                        Lv{" "}
                        {s.suitableLevelMin === s.suitableLevelMax
                          ? s.suitableLevelMin
                          : `${s.suitableLevelMin}–${s.suitableLevelMax}`}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

export default async function TrainingSpotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.level;
  const level = parseTrainingLevel(raw);
  // 空字串／未帶參數 = 初始引導；有值但 parse 不過 = validation error。
  const submitted = raw !== undefined && raw.trim() !== "";
  const invalid = submitted && level === null;
  const win = level !== null ? windowOf(level) : null;
  const school = resolveSchool(params.school);
  // ?elite=show 才顯示只有菁英符合的地圖；預設隱藏。
  const hideEliteOnly = params.elite !== "show";
  const sort = parseTrainingSort(params.sort);

  const all = mergeTrainingVariants(
    (level !== null ? getTrainingSpots(level) : []).map((s) => ({
      ...s,
      category: classifyTrainingStage(s),
    })),
  );
  const field = all.filter((s) => s.category === "field");
  const others = all.filter((s) => s.category !== "field");
  const eliteOnly = field.filter((s) => s.onlyElite);
  const visible = hideEliteOnly ? field.filter((s) => !s.onlyElite) : field;

  const skills = getSkillHitInfoBatch(SKILL_PICKS[school]);
  const dropData = getTrainingDropData(
    visible.flatMap((s) => s.suitableMonsters.map((m) => m.npcId)),
  );
  const details = new Map(
    visible.map((s) => [
      `${s.stageKind}:${s.stageId}`,
      { hit: spotHit(s, skills), drops: aggregateSpotDrops(s.suitableMonsters, dropData) },
    ]),
  );
  const detailOf = (s: TrainingSpotView) => details.get(`${s.stageKind}:${s.stageId}`)!;
  const spots = sortTrainingSpots(visible, sort, {
    hitMin: (s) => detailOf(s).hit.main?.min ?? null,
    equipCount: (s) => detailOf(s).drops.filter((d) => d.category === "equip").length,
  });

  const showAllParams = new URLSearchParams();
  if (raw) showAllParams.set("level", raw);
  if (params.school) showAllParams.set("school", params.school);
  if (params.sort) showAllParams.set("sort", params.sort);
  showAllParams.set("elite", "show");

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">練功地圖</h1>
        <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
          輸入等級和門派，看哪裡有適合你打的怪、要撐多少命中、會掉什麼。
        </p>
      </header>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {/* 三個控制項同高（h-10）、同一條底線；查詢放最後，代表等級和門派一起套用 */}
        <form action="/training-spots" method="get" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          {/* 換等級時保留門派、菁英過濾、排序 */}
          <input type="hidden" name="school" value={school} />
          {params.elite && <input type="hidden" name="elite" value={params.elite} />}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="level" className="text-sm font-medium">
              你的等級
            </label>
            <div className="relative sm:w-32">
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-xs text-muted-foreground"
              >
                Lv
              </span>
              <Input
                id="level"
                name="level"
                type="number"
                inputMode="numeric"
                min={MIN_MONSTER_LEVEL}
                max={MAX_MONSTER_LEVEL}
                step={1}
                defaultValue={raw ?? ""}
                placeholder={`${MIN_MONSTER_LEVEL} – ${MAX_MONSTER_LEVEL}`}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? "level-error" : "level-method"}
                className="h-10 pl-9 font-mono"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="school" className="text-sm font-medium">
              門派招式
            </label>
            <SchoolSelect
              id="school"
              value={school}
              className="w-full data-[size=default]:h-10 sm:w-40"
            />
          </div>
          <Button type="submit" className="col-span-2 h-10 px-4 text-sm font-bold">
            <SearchIcon aria-hidden />
            查詢
          </Button>
        </form>

        {invalid && (
          <p
            id="level-error"
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            等級需為 {MIN_MONSTER_LEVEL} 到 {MAX_MONSTER_LEVEL} 之間的整數，請重新輸入。
          </p>
        )}

        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <EliteFilterSwitch hideEliteOnly={hideEliteOnly} />

          <p
            id="level-method"
            className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
          >
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {win ? (
                <>
                  比對條件：怪物等級落在{" "}
                  <b className="font-mono font-medium text-foreground">
                    Lv {win.min} – {win.max}
                  </b>
                  （你的等級 ±{TRAINING_LEVEL_RADIUS}）。
                </>
              ) : (
                <>
                  比對條件：怪物等級落在你的等級{" "}
                  <b className="font-mono font-medium text-foreground">±{TRAINING_LEVEL_RADIUS}</b>{" "}
                  之內。
                </>
              )}
              只列走得到的野外地圖；副本、任務、寵物練功場收在最下面。
            </span>
          </p>
        </div>
      </section>

      {win === null && <InitialState />}

      {win !== null && all.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              符合條件的野外地圖 <b className="font-mono text-primary">{visible.length}</b> 張
            </h2>
            <TrainingSortToggle sort={sort} />
          </div>

          {hideEliteOnly && eliteOnly.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                已隱藏 {eliteOnly.length} 張只有菁英怪符合等級的地圖：
                {eliteOnly.map((s) => s.stageName).join("、")}
              </span>
              <Link
                href={`/training-spots?${showAllParams.toString()}`}
                scroll={false}
                className="font-medium text-primary hover:underline"
              >
                全部顯示
              </Link>
            </p>
          )}

          {spots.length > 0 ? (
            <div className="grid gap-3.5 md:grid-cols-2">
              {spots.map((spot) => {
                const d = detailOf(spot);
                return (
                  <TrainingSpotCard
                    key={`${spot.stageKind}:${spot.stageId}`}
                    spot={spot}
                    drops={d.drops}
                    hit={d.hit}
                    school={school}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              這個等級沒有符合條件的野外地圖，可以看看下方的其他地圖。
            </p>
          )}

          <OtherMaps spots={others} />
        </>
      )}

      {win !== null && all.length === 0 && (
        <section className="flex flex-col items-start gap-2.5 rounded-xl border border-dashed border-border bg-card px-4 py-6">
          <span className="grid size-9 place-items-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground">
            <SearchXIcon className="size-5" aria-hidden />
          </span>
          <h2 className="font-heading text-base font-semibold">沒有符合的地圖</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            資料庫中找不到怪物等級位於{" "}
            <b className="font-mono font-medium text-foreground">
              Lv {win.min} – {win.max}
            </b>{" "}
            的地圖。這代表資料庫沒有這個區間的刷怪點紀錄，不代表遊戲中不存在。
          </p>
          <Button render={<Link href="/maps" />} variant="outline" size="lg" className="mt-1">
            <MapIcon aria-hidden />
            瀏覽全部地圖
          </Button>
        </section>
      )}

      <SourceBlock />
    </div>
  );
}
