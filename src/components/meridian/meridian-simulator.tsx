"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, LinkIcon, MinusIcon, PlusIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EXP_PER_DANTIAN_BASE,
  INITIAL_LEVELS,
  QI_MAX,
  attemptBreak,
  convertExp,
  costBetween,
  decodePlan,
  encodePlan,
  expDiscount,
  fillAll,
  indexPoints,
  initialPlayState,
  levelOf,
  lowerTo,
  missingPrereqs,
  probBonus,
  raiseTo,
  restorePlayState,
  sumStats,
  type PlayState,
} from "@/lib/meridian-sim";
import type { MeridianData, MeridianLevels, MeridianStatFlag } from "@/lib/types/meridian";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { fmt, fmtExp } from "./format";
import { GameWindow, type Fx } from "./game-window";
import { EstBadge, PointDetail, SectionLabel, StatTable } from "./point-detail";

type Mode = "play" | "plan";

const BLOCK_MSG: Record<string, string> = {
  max: "這個穴位已經點滿了",
  prereq: "前置還沒達成",
  dantian: "丹田不夠",
  quest: "這一級要靠任務取得",
};

const STORAGE_KEY = "genbu:meridian:v1";

/** localStorage 存的格式；levels 一律存成 encodePlan 字串，讀回時交給 decodePlan 合法化。 */
interface Saved {
  mode: Mode;
  chan: number;
  sel: number;
  start: number;
  plan: string;
  play: Omit<PlayState, "levels"> & { levels: string };
}

function readSaved(): Partial<Record<keyof Saved, unknown>> {
  try {
    const o: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {}; // JSON 壞掉或無痕模式擋 storage：當作沒存過
  }
}

const clampInt = (v: string, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));

export function MeridianSimulator({ data }: { data: MeridianData }) {
  const idx = useMemo(() => indexPoints(data.points), [data.points]);
  const byChannel = useMemo(() => {
    const m = new Map<number, typeof data.points>();
    for (const c of data.channels) {
      m.set(
        c.channelNo,
        data.points.filter((p) => p.channelNo === c.channelNo).sort((a, b) => a.slot - b.slot),
      );
    }
    return m;
  }, [data]);

  const [mode, setMode] = useState<Mode>("play");
  const [chan, setChan] = useState(data.channels[0].channelNo);
  const [selId, setSelId] = useState(byChannel.get(data.channels[0].channelNo)![0].id);
  const [startInput, setStartInput] = useState("500");
  const [buyInput, setBuyInput] = useState("100");
  const [play, setPlay] = useState<PlayState>(() => initialPlayState(500));
  const [plan, setPlan] = useState<MeridianLevels>(INITIAL_LEVELS);
  const [fx, setFx] = useState<Fx>(null);
  const [toast, setToast] = useState({ msg: "", show: false, n: 0 });
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const sliderBefore = useRef<number | null>(null);

  // SSR 先用預設值渲染，mount 後才讀 localStorage／?p=，避免 hydration mismatch
  useEffect(() => {
    const saved = readSaved();
    const restored = restorePlayState(idx, saved.play);
    const start = Number(saved.start);
    const url = new URL(window.location.href);
    const shared = url.searchParams.get("p");
    // 分享連結優先於本機存檔的 plan
    const nextPlan = decodePlan(idx, shared ?? saved.plan);
    const nextMode: Mode = shared != null || saved.mode === "plan" ? "plan" : "play";
    const firstShared = Number(encodePlan(nextPlan).split(".")[0]);
    const point = idx.get(shared != null && firstShared ? firstShared : Number(saved.sel));
    const chanNo =
      point?.channelNo ?? (byChannel.has(Number(saved.chan)) ? Number(saved.chan) : null);
    if (shared != null) {
      // 載入後拿掉 ?p=，之後的改動交給 localStorage，重新整理不會被連結蓋回去
      url.searchParams.delete("p");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional SSR-safe hydration from localStorage
    if (restored) setPlay(restored);
    if (Number.isSafeInteger(start) && start >= 0 && start <= 65535) setStartInput(String(start));
    setPlan(nextPlan);
    setMode(nextMode);
    if (chanNo != null) {
      setChan(chanNo);
      setSelId(point?.id ?? byChannel.get(chanNo)![0].id);
    }
    setLoaded(true);
  }, [idx, byChannel]);

  useEffect(() => {
    if (!loaded) return; // 還沒讀完就寫，會把存檔蓋成預設值
    const saved: Saved = {
      mode,
      chan,
      sel: selId,
      start: clampInt(startInput, 0, 65535),
      plan: encodePlan(plan),
      play: { ...play, levels: encodePlan(play.levels) },
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // 容量滿或無痕模式：不保存也能玩
    }
  }, [loaded, mode, chan, selId, startInput, plan, play]);

  const planCode = encodePlan(plan);
  const share = async () => {
    const url = `${window.location.origin}/tools/meridian?p=${planCode}`;
    try {
      await navigator.clipboard.writeText(url);
      track("meridian_share", { via: "clipboard" });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("複製以下連結", url);
      track("meridian_share", { via: "prompt" });
    }
  };

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((s) => ({ ...s, show: false })), 1900);
    return () => clearTimeout(t);
  }, [toast.n, toast.show]);

  const say = (msg: string) => setToast((s) => ({ msg, show: true, n: s.n + 1 }));

  const channel = data.channels.find((c) => c.channelNo === chan)!;
  const chanPoints = byChannel.get(chan)!;
  const selected = idx.get(selId)!;
  const levels = mode === "play" ? play.levels : plan;

  const stats = useMemo(() => sumStats(idx, levels), [idx, levels]);
  const totals = useMemo(() => {
    const m = new Map<string, { value: number; flag: MeridianStatFlag }>();
    for (const s of stats) if (s.value) m.set(s.stat, { value: s.value, flag: s.flag });
    return m;
  }, [stats]);
  const bonus = probBonus(idx, levels);
  const planCost = useMemo(() => costBetween(idx, INITIAL_LEVELS, plan), [idx, plan]);
  const opened = (lv: MeridianLevels) => data.points.filter((p) => levelOf(lv, p.id) > 0).length;

  const selectPoint = (id: number) => {
    const p = idx.get(id);
    if (!p) return;
    setSelId(id);
    setChan(p.channelNo);
  };
  const selectChannel = (no: number) => {
    setChan(no);
    if (idx.get(selId)?.channelNo !== no) setSelId(byChannel.get(no)![0].id);
  };

  // ---- 體驗模式 ----
  const L = levelOf(play.levels, selId);
  const next = L + 1;
  const nextLv = selected.levels[next - 1];
  const maxed = next > selected.maxLevel;
  const reqOk = !maxed && missingPrereqs(idx, play.levels, selId, next).length === 0;
  const cost = nextLv?.cost ?? null;
  const enough = cost != null && cost <= play.dantian;
  const canBreak = mode === "play" && !maxed && reqOk && enough;

  const attempt = () => {
    const before = play;
    const p = selected;
    const lv = levelOf(before.levels, p.id) + 1;
    const r = attemptBreak(idx, before, p.id);
    track("meridian_attempt", { outcome: r.outcome });
    if (r.outcome === "blocked") {
      say(BLOCK_MSG[r.reason ?? ""] ?? "現在打不通");
      return;
    }
    setPlay(r.state);
    const spent = before.dantian - r.state.dantian;
    if (r.outcome === "success") {
      setFx({ kind: "pop", id: p.id, n: Date.now() });
      say(before.qi >= QI_MAX ? `${p.name} Lv${lv} 打通（氣海保底）` : `${p.name} Lv${lv} 打通`);
    } else {
      setFx({ kind: "miss", id: p.id, n: Date.now() });
      say(`打通失敗，丹田 −${fmt(spent)}，氣海 +${r.state.qi - before.qi}`);
    }
  };

  const resetPlay = (start: number) => {
    setPlay(initialPlayState(start));
    setFx(null);
    track("meridian_reset", { mode: "play" });
  };

  // ---- 規劃模式 ----
  const planSet = (id: number, target: number, report = true) => {
    const p = idx.get(id)!;
    const t = Math.max(INITIAL_LEVELS[id] ?? 0, Math.min(p.maxLevel, target));
    const cur = levelOf(plan, id);
    if (t === cur) return;
    setPlan(t > cur ? raiseTo(idx, plan, id, t) : lowerTo(idx, plan, id, t));
    if (report) track("meridian_point", { action: t > cur ? "add" : "remove" });
  };
  const fillChannel = () => {
    setPlan(chanPoints.reduce((lv, p) => raiseTo(idx, lv, p.id, p.maxLevel), plan));
    track("meridian_fill", { scope: "channel" });
  };
  const clearChannel = () => {
    setPlan(chanPoints.reduce((lv, p) => lowerTo(idx, lv, p.id, 0), plan));
    track("meridian_reset", { mode: "plan", scope: "channel" });
  };

  const planL = levelOf(plan, selId);
  const recentLog = play.log.slice(0, 8); // log 最新的在前
  const planMin = INITIAL_LEVELS[selId] ?? 0; // 承漿 Lv1 是任務給的，規劃時不能低於 1

  return (
    <Tabs value={mode} onValueChange={(v) => {
      if (v === mode) return;
      setMode(v as Mode);
      track("meridian_mode", { mode: String(v) });
    }} className="gap-0">
      <div className="mt-6 mb-5 flex flex-wrap items-center gap-3">
        <TabsList className="h-9">
          <TabsTrigger value="play" className="px-4">
            體驗模式
          </TabsTrigger>
          <TabsTrigger value="plan" className="px-4">
            規劃模式
          </TabsTrigger>
        </TabsList>
        <Badge variant="secondary" className="font-normal text-muted-foreground">
          {mode === "play" ? "擲骰打通，失敗一樣扣丹田" : "直接設等級，看成本與屬性"}
        </Badge>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ========== 左：遊戲視窗 ========== */}
        <div className="flex min-w-0 flex-col gap-3">
          <Tabs value={chan} onValueChange={(v) => selectChannel(Number(v))}>
            <TabsList className="h-9" aria-label="經脈">
              {data.channels.map((c) => (
                <TabsTrigger
                  key={c.channelNo}
                  value={c.channelNo}
                  className="px-3.5 font-heading tracking-widest sm:px-5"
                >
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <GameWindow
            images={data.images}
            channels={data.channels}
            channel={channel}
            points={chanPoints}
            idx={idx}
            levels={levels}
            selected={selected}
            totals={totals}
            bonus={bonus}
            qi={mode === "play" ? play.qi : 0}
            expText={
              mode === "play"
                ? play.spentExp
                  ? `−${fmtExp(play.spentExp)}`
                  : "0"
                : fmtExp(planCost.min * EXP_PER_DANTIAN_BASE)
            }
            dantianText={fmt(mode === "play" ? play.dantian : planCost.min)}
            dantian={mode === "play" ? play.dantian : null}
            canBreak={canBreak}
            fx={fx}
            onFxEnd={() => setFx(null)}
            toast={toast}
            onSelect={selectPoint}
            onChannel={selectChannel}
          />

          <p className="text-xs leading-relaxed text-muted-foreground">
            遊戲視窗依客戶端介面座標重建，右半的欄位會跟著模擬結果即時更新。在人形區點一下就會選到最近的穴位，不用戳準小圓點；手機上也可以用下面的穴位清單。
          </p>

          <Card size="sm">
            <CardHeader>
              <CardTitle>{channel.name} · 穴位</CardTitle>
              <CardAction>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {chanPoints.filter((p) => levelOf(levels, p.id) > 0).length} / {chanPoints.length}{" "}
                  已點
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {chanPoints.map((p) => {
                const lv = levelOf(levels, p.id);
                const sel = p.id === selId;
                return (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="xs"
                    aria-current={sel || undefined}
                    className={cn(
                      "rounded-full font-normal tabular-nums",
                      sel
                        ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:border-primary dark:bg-primary/15"
                        : lv > 0 && "border-chart-2/45 text-chart-2 hover:text-chart-2",
                    )}
                    onClick={() => selectPoint(p.id)}
                  >
                    {p.name}
                    <span className="opacity-75">
                      {lv}/{p.maxLevel}
                    </span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {mode === "plan" && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>{channel.name} · 穴位等級</CardTitle>
                <p className="text-xs text-muted-foreground">用 +／− 調整等級，前置會自動補齊。</p>
                <CardAction className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={fillChannel}>
                    本脈全滿
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearChannel}>
                    本脈清空
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="flex max-h-[340px] flex-col gap-0.5 overflow-auto">
                  {chanPoints.map((p) => {
                    const lv = levelOf(plan, p.id);
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/50",
                          p.id === selId &&
                            "bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/10",
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate rounded text-left text-[0.85rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => selectPoint(p.id)}
                        >
                          {p.name}
                        </button>
                        <span className="min-w-12 text-right text-[0.8rem] text-muted-foreground tabular-nums">
                          {lv} / {p.maxLevel}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`${p.name} 降一級`}
                          disabled={lv <= (INITIAL_LEVELS[p.id] ?? 0)}
                          onClick={() => {
                            selectPoint(p.id);
                            planSet(p.id, lv - 1);
                          }}
                        >
                          <MinusIcon />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`${p.name} 升一級`}
                          disabled={lv >= p.maxLevel}
                          onClick={() => {
                            selectPoint(p.id);
                            planSet(p.id, lv + 1);
                          }}
                        >
                          <PlusIcon />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========== 右：資訊欄 ========== */}
        <div className="min-w-0">
          <TabsContent value="play" className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>丹田</CardTitle>
                <CardAction>
                  <Badge variant="secondary" className="font-normal">
                    1 億經驗 = 1 丹田
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Big value={fmt(play.dantian)} unit="丹田" />
                <Separator className="my-3.5" />
                <div className="flex flex-col gap-2.5">
                  <Field label="起始丹田" id="mer-start">
                    <Input
                      id="mer-start"
                      type="number"
                      min={0}
                      max={65535}
                      step={50}
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      className="w-26 tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const v = clampInt(startInput, 0, 65535);
                        setStartInput(String(v));
                        resetPlay(v);
                        say(`起始丹田設為 ${fmt(v)}`);
                      }}
                    >
                      套用並重來
                    </Button>
                  </Field>
                  <Field label="換丹田" id="mer-buy">
                    <Input
                      id="mer-buy"
                      type="number"
                      min={1}
                      max={9999}
                      step={10}
                      value={buyInput}
                      onChange={(e) => setBuyInput(e.target.value)}
                      className="w-26 tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const n = clampInt(buyInput, 1, 9999);
                        setBuyInput(String(n));
                        const s = convertExp(idx, play, n);
                        setPlay(s);
                        track("meridian_convert_exp");
                        say(
                          `換到 ${fmt(s.dantian - play.dantian)} 丹田，花了 ${fmtExp(s.spentExp - play.spentExp)} 經驗`,
                        );
                      }}
                    >
                      用經驗換
                    </Button>
                  </Field>
                </div>
                <KV
                  className="mt-3"
                  rows={[
                    ["換丹田折扣", `−${expDiscount(idx, play.levels)}%`],
                    ["已花經驗", fmtExp(play.spentExp)],
                  ]}
                />
                <Hint>承漿、璇璣每級讓換丹田少扣 1% 經驗，兩個都滿是 −10%。</Hint>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>氣海</CardTitle>
                <CardAction>
                  <Badge
                    variant="secondary"
                    className={cn("font-normal", play.qi >= QI_MAX && "bg-primary/10 text-primary")}
                  >
                    {play.qi >= QI_MAX ? "下一次必定成功" : "全角色共用"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Big value={String(play.qi)} unit={`/ ${QI_MAX}`} />
                <div
                  aria-hidden
                  className="mt-2 mb-1 h-2 overflow-hidden rounded-full border border-border/60 bg-muted"
                >
                  <div
                    className={cn(
                      "h-full transition-[width] duration-300",
                      play.qi >= QI_MAX
                        ? "bg-gradient-to-r from-chart-4 to-primary"
                        : "bg-gradient-to-r from-chart-2 to-chart-3",
                    )}
                    style={{ width: `${Math.min(100, (play.qi / QI_MAX) * 100)}%` }}
                  />
                </div>
                <Hint>每次打通失敗 +1。累積到 {QI_MAX} 時，下一次打通必定成功，之後歸零。</Hint>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent>
                <PointDetail
                  point={selected}
                  channelName={channel.name}
                  levels={play.levels}
                  idx={idx}
                  bonus={probBonus(idx, play.levels)}
                  onSelect={selectPoint}
                >
                  {!maxed && (
                    <>
                      <Separator className="my-3.5" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="lg" className="px-4" disabled={!canBreak} onClick={attempt}>
                          <ZapIcon />
                          打通經脈
                        </Button>
                        {cost == null ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            這一級要靠任務取得
                          </Badge>
                        ) : !reqOk ? (
                          <Badge
                            variant="outline"
                            className="border-primary/50 font-normal text-primary"
                          >
                            前置還沒達成
                          </Badge>
                        ) : !enough ? (
                          <Badge
                            variant="outline"
                            className="border-primary/50 font-normal text-primary"
                          >
                            丹田不夠（差 {fmt(cost - play.dantian)}）
                          </Badge>
                        ) : play.qi >= QI_MAX ? (
                          <Badge
                            variant="outline"
                            className="border-chart-2/45 font-normal text-chart-2"
                          >
                            氣海保底，這次一定成功
                          </Badge>
                        ) : null}
                      </div>
                    </>
                  )}
                </PointDetail>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>紀錄</CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetPlay(clampInt(startInput, 0, 65535));
                      say("已重來");
                    }}
                  >
                    <RotateCcwIcon />
                    重來
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="嘗試" value={play.attempts} />
                  <Metric label="成功" value={play.successes} />
                  <Metric label="失敗" value={play.failures} />
                </div>
                <KV
                  rows={[
                    ["總花費丹田", `${fmt(play.spentDantian)} 丹田`],
                    ["等值經驗", fmtExp(play.spentDantian * EXP_PER_DANTIAN_BASE)],
                    ["已點穴位", `${opened(play.levels)} / ${data.points.length}`],
                  ]}
                />
                {recentLog.length ? (
                  <ul className="flex flex-col gap-1.5 text-[0.8rem]">
                    {recentLog.map((e, i) => (
                      <li
                        key={play.attempts - i}
                        className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 tabular-nums"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            e.ok ? "bg-chart-2" : "bg-primary",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {idx.get(e.id)?.name ?? e.id} Lv{e.level}
                          {e.guaranteed && "（保底）"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.ok ? "成功" : "失敗"} · −{fmt(e.cost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>還沒有紀錄。</Empty>
                )}
              </CardContent>
            </Card>

            <StatsCard title="目前屬性總和" stats={stats} empty="還沒點任何穴位。" />
          </TabsContent>

          <TabsContent value="plan" className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>這套配置的成本</CardTitle>
                <CardAction className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => {
                    setPlan(fillAll(idx));
                    track("meridian_fill", { scope: "all" });
                  }}>
                    全滿
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setPlan(INITIAL_LEVELS);
                    track("meridian_reset", { mode: "plan", scope: "all" });
                  }}>
                    清空
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <SectionLabel>需要丹田（每次都成功的下限）</SectionLabel>
                <Big value={fmt(planCost.min)} unit="丹田" />
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3.5 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">等值經驗</dt>
                  <dd className="text-right tabular-nums">
                    {fmtExp(planCost.min * EXP_PER_DANTIAN_BASE)}
                  </dd>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    含失敗的平均 <EstBadge>平均估算</EstBadge>
                  </dt>
                  <dd className="text-right tabular-nums">{fmt(planCost.expected)} 丹田</dd>
                  <dt className="text-muted-foreground">平均等值經驗</dt>
                  <dd className="text-right tabular-nums">
                    {fmtExp(planCost.expected * EXP_PER_DANTIAN_BASE)}
                  </dd>
                  <dt className="text-muted-foreground">已配置穴位</dt>
                  <dd className="text-right tabular-nums">
                    {opened(plan)} / {data.points.length}
                  </dd>
                </dl>
                <Hint>
                  平均是把每一級的「花費 ÷
                  基本成功率」加起來，沒有算天突、膻中的加成，也沒算氣海保底，所以實際跑起來通常會比這個數字低一些。
                </Hint>
                <Separator className="my-3.5" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Button variant="outline" size="sm" disabled={!planCode} onClick={share}>
                    {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
                    {copied ? "已複製連結" : "複製分享連結"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {planCode ? "朋友打開就會看到這套配點。" : "先配幾個穴位才能分享。"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card size="sm">
              <CardContent>
                <PointDetail
                  point={selected}
                  channelName={channel.name}
                  levels={plan}
                  idx={idx}
                  bonus={probBonus(idx, plan)}
                  onSelect={selectPoint}
                >
                  <Separator className="my-3.5" />
                  <SectionLabel>設定等級</SectionLabel>
                  <div className="flex items-center gap-3">
                    <Slider
                      min={planMin}
                      max={selected.maxLevel}
                      step={1}
                      value={planL}
                      onValueChange={(v) => {
                        sliderBefore.current ??= planL;
                        planSet(selId, Array.isArray(v) ? v[0] : v, false);
                      }}
                      onValueCommitted={(v) => {
                        const target = Array.isArray(v) ? v[0] : v;
                        const before = sliderBefore.current;
                        sliderBefore.current = null;
                        if (before != null && target !== before) {
                          track("meridian_point", { action: target > before ? "add" : "remove" });
                        }
                      }}
                      aria-label={`${selected.name} 等級`}
                      className="flex-1"
                    />
                    <span className="min-w-14 text-right text-sm tabular-nums">
                      {planL} / {selected.maxLevel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => planSet(selId, selected.maxLevel)}
                    >
                      點滿這個穴位
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={planL <= planMin}
                      onClick={() => planSet(selId, 0)}
                    >
                      清掉這個穴位
                    </Button>
                  </div>
                  <Hint>
                    調高等級時，缺的前置會自動一起補齊；調低時，依賴它的穴位也會跟著降下來。
                  </Hint>
                </PointDetail>
              </CardContent>
            </Card>

            <StatsCard title="屬性總和" stats={stats} empty="還沒配置任何穴位。" />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}

/* ---------- 小元件 ---------- */

function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="font-heading text-3xl leading-tight font-semibold tabular-nums">
      {value}
      <small className="ml-1 font-sans text-[0.8rem] font-normal text-muted-foreground">
        {unit}
      </small>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="min-w-19 text-[0.8rem] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function KV({ rows, className }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[1fr_auto] gap-x-3.5 gap-y-1 text-sm", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
      <div className="text-[0.7rem] tracking-wide text-muted-foreground">{label}</div>
      <div className="font-heading text-lg leading-snug tabular-nums">{fmt(value)}</div>
    </div>
  );
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
);
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-[0.8rem] text-muted-foreground">{children}</p>
);

function StatsCard({
  title,
  stats,
  empty,
}: {
  title: string;
  stats: { stat: string; value: number; flag: MeridianStatFlag }[];
  empty: string;
}) {
  const n = stats.filter((s) => s.value).length;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Badge variant="secondary" className="font-normal tabular-nums">
            {n} 項
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>{n ? <StatTable stats={stats} /> : <Empty>{empty}</Empty>}</CardContent>
    </Card>
  );
}
