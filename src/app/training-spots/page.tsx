import type { Metadata } from "next";
import Link from "next/link";
import {
  DatabaseIcon,
  InfoIcon,
  MapIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingSpotCard } from "@/components/maps/training-spot-card";
import {
  TRAINING_LEVEL_RADIUS,
  getTrainingSpots,
  parseTrainingLevel,
} from "@/lib/queries/monster-spawns";
import { MAX_MONSTER_LEVEL, MIN_MONSTER_LEVEL } from "@/lib/constants/monster-level";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "練功地圖 · 玄武",
  description: "輸入你的等級，依資料庫怪物等級尋找候選地圖",
};

interface PageProps {
  searchParams: Promise<{ level?: string }>;
}

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
        monster_spawns · stages · npc · monsters
      </span>,
    ],
    [
      "方法",
      <>
        怪物等級落在玩家等級 <b className="font-mono font-medium text-foreground">±5</b>
        （上下界含端點、clamp 到
        1–200），集中度依刷怪點加權。此為本站以資料庫欄位推導的比對規則，非官方數值，也未經實機驗證。
      </>,
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
        輸入等級後，這裡會列出每張地圖有哪些怪、各自幾等，以及該地圖的刷怪點數。
      </p>
      <ol className="mt-1 flex w-full flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
        {[
          `填入等級（${MIN_MONSTER_LEVEL}–${MAX_MONSTER_LEVEL}）`,
          `取出怪物等級在 ±${TRAINING_LEVEL_RADIUS} 區間內的刷怪點`,
          "依等級集中度、適配刷怪點數列出地圖",
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

export default async function TrainingSpotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.level;
  const level = parseTrainingLevel(raw);
  // 空字串／未帶參數 = 初始引導；有值但 parse 不過 = validation error。
  const submitted = raw !== undefined && raw.trim() !== "";
  const invalid = submitted && level === null;
  const win = level !== null ? windowOf(level) : null;
  const spots = level !== null ? getTrainingSpots(level) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">練功地圖</h1>
        <p className="max-w-[54ch] text-sm text-muted-foreground">
          輸入你的等級，從資料庫比對怪物等級與你接近的地圖。
        </p>
      </header>

      <form
        action="/training-spots"
        method="get"
        className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      >
        <label htmlFor="level" className="mb-2 block text-sm font-medium">
          你的等級
        </label>
        <div className="flex max-w-lg gap-2">
          <div className="relative flex-1">
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
              className="h-11 pl-9 font-mono"
            />
          </div>
          <Button type="submit" size="lg" className="h-11 px-4 text-sm font-bold">
            <SearchIcon aria-hidden />
            查詢
          </Button>
        </div>

        {invalid && (
          <p
            id="level-error"
            role="alert"
            className="mt-2.5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            等級需為 {MIN_MONSTER_LEVEL} 到 {MAX_MONSTER_LEVEL} 之間的整數，請重新輸入。
          </p>
        )}

        <p
          id="level-method"
          className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
        >
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {win ? (
              <>
                比對條件：怪物等級落在{" "}
                <b className="font-mono font-medium text-foreground">
                  Lv {win.min} – {win.max}
                </b>
                （你的等級 ±{TRAINING_LEVEL_RADIUS}）。卡片內顯示的怪都在這個區間。
              </>
            ) : (
              <>
                比對條件：怪物等級落在你的等級{" "}
                <b className="font-mono font-medium text-foreground">±{TRAINING_LEVEL_RADIUS}</b>{" "}
                之內。
              </>
            )}
          </span>
        </p>
      </form>

      {win === null && <InitialState />}

      {win !== null && spots.length > 0 && (
        <>
          <div className="space-y-1">
            <h2 className="text-sm font-medium">
              符合條件的地圖 <b className="font-mono text-primary">{spots.length}</b> 張
            </h2>
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
              依等級集中度、適配刷怪點數由高到低排列。等級集中度為本站以資料庫欄位計算的比值，非遊戲內數值。
            </p>
          </div>
          <div className="grid gap-3.5 md:grid-cols-2">
            {spots.map((spot) => (
              <TrainingSpotCard key={`${spot.stageKind}:${spot.stageId}`} spot={spot} />
            ))}
          </div>
        </>
      )}

      {win !== null && spots.length === 0 && (
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
