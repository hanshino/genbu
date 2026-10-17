"use client";

import { CheckIcon, RefreshCwIcon, ScrollTextIcon, SearchIcon, SwordsIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GAME_SPEED, SYNC_INTERVAL_MS, TICK_MS } from "@/configs/idle";
import { buildCombatant } from "@/lib/idle/character";
import { advance, expToNext } from "@/lib/idle/engine";
import { canChangeJob, stylesFor, type JobChoice } from "@/lib/idle/job";
import { activeSkill } from "@/lib/idle/skills";
import type { IdleData, IdleEvent, IdleState, IdleSummary } from "@/lib/idle/types";
import {
  LOG_LIMIT,
  NORMAL_ATTACK_NAME,
  applyEvents,
  describeEvent,
  formatClock,
  formatNumber,
  killRateFromSummary,
  killsPerHour,
  newFx,
  nextLogContext,
  offlineWorthShowing,
  type LogContext,
} from "@/lib/idle/view";
import { ATTRIBUTE_KEYS } from "@/lib/types/stat-sim";
import { getSave, postBeacon, postJson, type IdleBoot, type IdleView } from "./api";
import { prefetchBundle } from "./bundles";
import { CharacterTab, type Draft } from "./character-tab";
import { JobDialog } from "./job-dialog";
import { IdleScene } from "./idle-scene";
import { LogTab } from "./log-tab";
import { OfflineDialog } from "./offline-dialog";
import type { LogEntry, Runtime } from "./runtime";
import { SkillsTab } from "./skills-tab";

type TabKey = "character" | "skills" | "log";
type SaveStatus = { kind: "saved"; at: number } | { kind: "syncing"; at: number } | { kind: "error"; at: number };

const SNAPSHOT_MS = 250;

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 存檔內容的指紋（不含每次存檔都會變的計數與時間），用來確認瀏覽器與伺服器重跑的結果一致。 */
function fingerprint(state: IdleState): string {
  return JSON.stringify({ ...state, saveCounter: 0, lastSettledAt: 0 });
}

function logContextFor(state: IdleState, data: IdleData): LogContext {
  const phase = state.phase;
  const monster = phase.kind === "searching" ? null : data.monsters[phase.monsterId];
  const skillId = phase.kind === "casting" ? phase.skillId : null;
  const skill = skillId == null ? null : data.skills.find((s) => s.id === skillId);
  return { monsterName: monster?.name ?? "怪物", skillName: skill?.name ?? NORMAL_ATTACK_NAME };
}

function createRuntime(state: IdleState, data: IdleData, summary: IdleSummary | null, notice: string | null): Runtime {
  const now = Date.now();
  return {
    state,
    clock: 0,
    acc: 0,
    last: 0,
    unsynced: 0,
    fx: newFx(),
    logCtx: logContextFor(state, data),
    log: notice ? [{ id: 0, time: formatClock(now), text: notice, gain: "" }] : [],
    logSeq: notice ? 1 : 0,
    killTimes: [],
    startedAt: now,
    sessionKills0: state.stats.kills,
    lastRate: summary ? killRateFromSummary(summary) : null,
  };
}

interface Vitals {
  rate: number | null;
  sessionMs: number;
  sessionKills: number;
}

export function IdlePlayer({
  initial,
  offline,
  boot,
  notice,
  onReload,
}: {
  initial: IdleState;
  offline: IdleSummary | null;
  boot: IdleBoot;
  /** 重新載入後要先放進戰鬥紀錄的一行（例如拜入門派）。 */
  notice: string | null;
  /** 角色換了預設角色（轉職）：整個重新載入，場景與資料才會換成新的。 */
  onReload: (notice: string | null) => void;
}) {
  const { data, scene } = boot;
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedMotionNow, () => false);

  const [seed] = useState(() => createRuntime(initial, data, offline, notice));
  const rt = useRef<Runtime>(seed);
  const drawRef = useRef<(() => void) | null>(null);

  const [snap, setSnap] = useState<IdleState>(initial);
  const [vitals, setVitals] = useState<Vitals>({ rate: seed.lastRate, sessionMs: 0, sessionKills: 0 });
  const [log, setLog] = useState<LogEntry[]>(() => seed.log.slice());
  const [tab, setTab] = useState<TabKey>("character");
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveStatus>(() => ({ kind: "saved", at: Date.now() }));
  const [summary, setSummary] = useState<IdleSummary | null>(() =>
    offline && offlineWorthShowing(offline) ? offline : null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [jobOpen, setJobOpen] = useState(false);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const jobPrompted = useRef(false);
  /** 轉職成功、整頁即將重新載入：之後排隊中的同步結果不再處理。 */
  const reloading = useRef(false);

  // 請求排隊：同一時間只送一個，每個都用送出當下最新的存檔計數。
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const syncQueued = useRef(false);
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.current.then(fn, fn);
    chain.current = p.catch(() => {});
    return p;
  }, []);

  const adopt = useCallback(
    (state: IdleState) => {
      if (reloading.current) return;
      // 別的分頁已經轉職：這裡載的是舊角色的資料，整個重新載入。
      if (state.presetId !== data.presetId || (state.weaponItemId ?? data.weapon?.id) !== data.weapon?.id) {
        onReload(null);
        return;
      }
      const r = rt.current;
      r.state = state;
      r.fx = newFx();
      r.unsynced = 0;
      r.acc = 0;
      r.logCtx = logContextFor(state, data);
      setSnap(state);
    },
    [data, onReload],
  );

  const doSync = useCallback(async () => {
    syncQueued.current = false;
    const r = rt.current;
    const sent = r.unsynced;
    r.unsynced = 0;
    const probe = fingerprint(r.state);
    setSave({ kind: "syncing", at: Date.now() });
    const res = await postJson<IdleView>("/api/idle/sync", { saveCounter: r.state.saveCounter, clientTicks: sent });
    if (res.ok) {
      const server = res.body.state;
      if (fingerprint(server) === probe) {
        // 伺服器重跑的結果和這裡一致：只換存檔計數，不動正在播的畫面。
        r.state = { ...r.state, saveCounter: server.saveCounter, lastSettledAt: server.lastSettledAt };
      } else {
        if (process.env.NODE_ENV !== "production") console.warn("[idle] 伺服器重跑的結果與瀏覽器不同，改用伺服器的存檔", { sent });
        adopt(server);
      }
      setSave({ kind: "saved", at: Date.now() });
    } else if (res.status === 409 && res.state) {
      adopt(res.state);
      setSave({ kind: "saved", at: Date.now() });
    } else {
      r.unsynced += sent;
      setSave({ kind: "error", at: Date.now() });
    }
  }, [adopt]);

  const requestSync = useCallback(() => {
    if (syncQueued.current) return;
    syncQueued.current = true;
    void enqueue(doSync);
  }, [enqueue, doSync]);

  const act = useCallback(
    (path: string, body: Record<string, unknown>) => {
      setBusy(true);
      setActionError(null);
      return enqueue(async () => {
        const r = rt.current;
        const res = await postJson<IdleView>(path, { saveCounter: r.state.saveCounter, ...body });
        setBusy(false);
        if (res.ok) {
          adopt(res.body.state);
          setDraft({});
          setSave({ kind: "saved", at: Date.now() });
        } else if (res.status === 409 && res.state) {
          adopt(res.state);
          setDraft({});
          setActionError("存檔已在別處更新，已重新載入。");
        } else {
          setActionError(res.error);
        }
      });
    },
    [enqueue, adopt],
  );

  const changeJob = useCallback(
    (job: JobChoice) => {
      setJobBusy(true);
      setJobError(null);
      return enqueue(async () => {
        const r = rt.current;
        const res = await postJson<IdleView>("/api/idle/job-change", { saveCounter: r.state.saveCounter, sectId: job.sectId });
        if (res.ok) {
          // 保持「處理中」直到整頁換成新角色。
          reloading.current = true;
          onReload(`拜入${job.sectName}門下`);
          return;
        }
        setJobBusy(false);
        if (res.status === 409 && res.state) {
          adopt(res.state);
          setJobError("存檔已在別處更新，已重新載入，請再選一次。");
        } else {
          setJobError(res.error);
        }
      });
    },
    [enqueue, adopt, onReload],
  );

  // 換武器流派：外觀、武器與技能都換成新的，和轉職一樣整個重新載入。
  const changeWeapon = useCallback(
    (key: string) => {
      setBusy(true);
      setActionError(null);
      return enqueue(async () => {
        const r = rt.current;
        const res = await postJson<IdleView>("/api/idle/weapon", { saveCounter: r.state.saveCounter, style: key });
        if (res.ok) {
          reloading.current = true;
          const style = stylesFor(r.state.sectId).find((s) => s.key === key);
          onReload(style ? `改拿${style.weaponName}，練${style.label}` : null);
          return;
        }
        setBusy(false);
        if (res.status === 409 && res.state) {
          adopt(res.state);
          setActionError("存檔已在別處更新，已重新載入。");
        } else {
          setActionError(res.error);
        }
      });
    },
    [enqueue, adopt, onReload],
  );

  // 遊戲迴圈：跑與伺服器相同的引擎，畫面與紀錄由事件驅動；分頁看不到時停掉，離線時間交給伺服器結算。
  useEffect(() => {
    let raf = 0;
    let running = false;
    let syncTimer = 0;
    let lastSnapshot = 0;
    let hiddenSent = false;
    const msPerTick = TICK_MS / GAME_SPEED;

    const flushSnapshot = (t: number) => {
      const r = rt.current;
      lastSnapshot = t;
      setSnap(r.state);
      setLog(r.log.slice());
      const nowMs = Date.now();
      const rate = killsPerHour(r.killTimes, nowMs, r.startedAt);
      if (rate != null) r.lastRate = rate;
      setVitals({ rate: r.lastRate, sessionMs: nowMs - r.startedAt, sessionKills: r.state.stats.kills - r.sessionKills0 });
      setNow(nowMs);
    };

    const handleEvents = (events: IdleEvent[], base: number): boolean => {
      const r = rt.current;
      applyEvents(r.fx, events, base);
      let urgent = false;
      for (const e of events) {
        r.logCtx = nextLogContext(r.logCtx, e, data);
        const line = describeEvent(e, r.logCtx);
        if (line) {
          r.log.unshift({ id: r.logSeq++, time: formatClock(Date.now()), ...line });
          if (r.log.length > LOG_LIMIT) r.log.length = LOG_LIMIT;
        }
        if (e.type === "kill") r.killTimes.push(Date.now());
        if (e.type === "level-up" || e.type === "kill" || e.type === "hit-too-low") urgent = true;
        if (e.type === "level-up") requestSync();
      }
      if (r.killTimes.length > 4000) r.killTimes.splice(0, r.killTimes.length - 2000);
      return urgent;
    };

    const step = (t: number) => {
      const r = rt.current;
      r.acc += Math.min(250, t - r.last);
      r.last = t;
      const ticks = Math.floor(r.acc / msPerTick);
      let urgent = false;
      if (ticks > 0) {
        r.acc -= ticks * msPerTick;
        const base = r.clock;
        const phaseBefore = r.state.phase.kind;
        const res = advance(r.state, ticks, data, { collectEvents: true });
        r.state = res.state;
        // 階段一換就更新狀態標籤，不要等下一次定時快照。
        if (res.state.phase.kind !== phaseBefore) urgent = true;
        r.clock += ticks;
        r.unsynced += ticks;
        if (res.events.length > 0 && handleEvents(res.events, base)) urgent = true;
      }
      drawRef.current?.();
      if (urgent || t - lastSnapshot >= SNAPSHOT_MS) flushSnapshot(t);
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      rt.current.last = performance.now();
      rt.current.acc = 0;
      raf = requestAnimationFrame(step);
      syncTimer = window.setInterval(requestSync, SYNC_INTERVAL_MS);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearInterval(syncTimer);
    };

    // 離開頁面：把跑了多久送出去（keepalive 讓請求在頁面關掉後仍會送完），然後停掉迴圈。
    const onHidden = () => {
      if (hiddenSent) return;
      hiddenSent = true;
      const r = rt.current;
      postBeacon("/api/idle/sync", { saveCounter: r.state.saveCounter, clientTicks: r.unsynced });
      r.unsynced = 0;
      stop();
    };

    // 回到頁面：向伺服器要最新存檔（它會結算離開期間），久的話顯示歡迎回來。
    const onVisible = async () => {
      hiddenSent = false;
      const res = await enqueue(() => getSave());
      if (document.visibilityState !== "visible") return;
      if (res.ok && res.body.state) {
        const view = res.body as IdleView;
        const r = rt.current;
        adopt(view.state);
        r.killTimes = [];
        r.startedAt = Date.now();
        if (view.offlineSummary) {
          const rate = killRateFromSummary(view.offlineSummary);
          if (rate != null) r.lastRate = rate;
          if (offlineWorthShowing(view.offlineSummary)) setSummary(view.offlineSummary);
        }
        setSave({ kind: "saved", at: Date.now() });
      }
      start();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHidden();
      else void onVisible();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHidden);
    if (document.visibilityState === "visible") start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHidden);
      stop();
    };
  }, [data, adopt, enqueue, requestSync]);

  // 目前實際使用的招式（引擎同一套規則）；換招或升級後預先載入它的演出資料。
  const attrKey = ATTRIBUTE_KEYS.map((k) => snap.attributes[k]).join(",");
  const active = useMemo(
    () => activeSkill(data, snap.level, buildCombatant(snap, data), snap.skillId),
    // snap 每次快照都是新物件；只有等級、六圍、技能設定會改變結果。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, snap.level, attrKey, snap.skillId],
  );
  useEffect(() => {
    if (active) prefetchBundle(active.skillId, active.level);
  }, [active]);
  const activeName = active ? (data.skills.find((s) => s.id === active.skillId)?.name ?? "招式") : NORMAL_ATTACK_NAME;

  const phase = snap.phase;
  const blockedHit = useMemo(
    () => (phase.kind === "blocked" ? buildCombatant(snap, data).attacker.hit : null),
    // 同上：只在命中不足、等級或六圍變動時重算。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, phase.kind, snap.level, attrKey],
  );

  // 到 9 級的入門弟子自動持有轉職證書；進頁面或剛升到 9 級時自動跳出一次（歡迎回來的視窗關掉之後）。
  const jobReady = canChangeJob(snap);
  useEffect(() => {
    if (jobReady && summary === null && !jobPrompted.current) {
      jobPrompted.current = true;
      setJobOpen(true);
    }
  }, [jobReady, summary]);

  const need = expToNext(snap.level, data);
  const pct = Number.isFinite(need) && need > 0 ? Math.min(100, Math.floor((snap.exp / need) * 100)) : 0;
  const sessionMinutes = Math.floor(vitals.sessionMs / 60_000);

  const draftDelta = () => Object.fromEntries(Object.entries(draft).filter(([, v]) => (v ?? 0) > 0));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-black tracking-wide sm:text-3xl">摸魚練功房</h1>
          <p className="text-muted-foreground text-sm">
            {snap.name ? `${snap.name}　` : ""}
            {scene.presetLabel}　練功地點：{scene.stageName}
          </p>
        </div>
        <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-[13px]" aria-live="polite">
          {save.kind === "syncing" ? (
            <RefreshCwIcon className="motion-safe:animate-spin" aria-hidden />
          ) : save.kind === "error" ? (
            <TriangleAlertIcon className="text-destructive" aria-hidden />
          ) : (
            <CheckIcon aria-hidden />
          )}
          {save.kind === "syncing" ? "存檔中…" : save.kind === "error" ? "存檔失敗，稍後重試" : `已存檔 · ${agoLabel(now - save.at)}`}
        </Badge>
      </header>

      <Card className="gap-0 py-0">
        <IdleScene rt={rt} data={data} scene={scene} reducedMotion={reducedMotion} drawRef={drawRef}>
          <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-4">
            {phase.kind === "blocked" ? (
              <Badge className="h-7 gap-1.5 bg-red-950/90 px-3 text-sm text-red-100 sm:h-8 dark:bg-red-950/90">
                <TriangleAlertIcon aria-hidden />
                命中不足
              </Badge>
            ) : phase.kind === "searching" ? (
              <Badge className="h-7 gap-1.5 bg-black/75 px-3 text-sm text-white sm:h-8" role="status">
                <SearchIcon aria-hidden />
                找怪中…
              </Badge>
            ) : (
              <Badge className="h-7 gap-1.5 bg-primary/90 px-3 text-sm sm:h-8" role="status">
                <SwordsIcon aria-hidden />
                戰鬥中 · {activeName}
              </Badge>
            )}
          </div>
          <div className="absolute top-3.5 right-4 hidden rounded-md bg-black/70 px-3 py-1.5 text-[13px] text-white sm:block">
            本次掛機 {sessionMinutes < 1 ? "不到 1" : sessionMinutes} 分 · 擊倒 {formatNumber(vitals.sessionKills)}
          </div>
        </IdleScene>

        {phase.kind === "blocked" && (
          <div
            role="alert"
            className="bg-destructive/10 text-foreground border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-sm sm:px-5"
          >
            <TriangleAlertIcon className="text-destructive size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 leading-relaxed">
              命中不足，打不到怪：需要命中 <b className="tabular-nums">{formatNumber(phase.required)}</b>
              {blockedHit != null && (
                <>
                  （目前 <span className="tabular-nums">{formatNumber(Math.floor(blockedHit))}</span>）
                </>
              )}
              ，建議加點技巧。
            </p>
            <Button size="sm" className="h-9 px-3" onClick={() => setTab("character")}>
              去配點
            </Button>
          </div>
        )}

        <div className="border-border flex flex-wrap items-center gap-x-6 gap-y-3 border-t px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="font-heading text-xl font-bold sm:text-[22px]">Lv.{snap.level}</div>
          <Progress
            value={pct}
            aria-label="經驗"
            className="min-w-0 flex-[1_1_240px] flex-col gap-1.5"
            getAriaValueText={() => `${snap.exp} / ${Number.isFinite(need) ? need : "—"}`}
          >
            <div className="text-muted-foreground flex w-full justify-between text-xs">
              <span>經驗</span>
              <span className="tabular-nums">
                {Number.isFinite(need) ? `${formatNumber(snap.exp)} / ${formatNumber(need)}（${pct}%）` : "已達上限"}
              </span>
            </div>
          </Progress>
          <div className="flex gap-5 text-sm">
            <div>
              <span className="text-muted-foreground">金錢 </span>
              <b className="tabular-nums">{formatNumber(snap.money)}</b>
            </div>
            <div>
              <span className="text-muted-foreground">每小時 </span>
              <b className="tabular-nums">{vitals.rate == null ? "—" : `約 ${formatNumber(vitals.rate)} 隻`}</b>
            </div>
          </div>
          {jobReady && (
            <Badge
              variant="outline"
              className="border-primary text-primary h-7 px-3 text-[13px]"
              render={<button type="button" aria-label="可轉職，選擇門派" onClick={() => setJobOpen(true)} />}
            >
              <ScrollTextIcon aria-hidden />
              可轉職
            </Badge>
          )}
          {snap.unspentPoints > 0 && (
            <Badge
              className="h-7 px-3 text-[13px]"
              render={<button type="button" aria-label={`${snap.unspentPoints} 點可分配，前往配點`} onClick={() => setTab("character")} />}
            >
              {snap.unspentPoints} 點可分配
            </Badge>
          )}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-4">
        <TabsList
          variant="line"
          aria-label="面板"
          className="border-border w-full justify-start rounded-none border-b group-data-horizontal/tabs:h-11 sm:w-fit"
        >
          <TabsTrigger value="character" className="h-full px-4 text-[15px]">
            角色
          </TabsTrigger>
          <TabsTrigger value="skills" className="h-full px-4 text-[15px]">
            技能
          </TabsTrigger>
          <TabsTrigger value="log" className="h-full px-4 text-[15px]">
            戰鬥紀錄
          </TabsTrigger>
        </TabsList>
        <TabsContent value="character">
          <CharacterTab
            state={snap}
            data={data}
            draft={draft}
            busy={busy}
            error={actionError}
            onDraft={setDraft}
            onConfirm={() => void act("/api/idle/allocate", { attributes: draftDelta() })}
            onWeapon={(key) => void changeWeapon(key)}
          />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab state={snap} data={data} busy={busy} onPick={(skillId) => void act("/api/idle/skill", { skillId })} />
          {actionError && (
            <p role="alert" className="text-destructive mt-2 text-sm">
              {actionError}
            </p>
          )}
        </TabsContent>
        <TabsContent value="log">
          <LogTab entries={log} />
        </TabsContent>
      </Tabs>

      <JobDialog
        open={jobOpen && jobReady && summary === null}
        gender={snap.gender}
        busy={jobBusy}
        error={jobError}
        onClose={() => {
          setJobOpen(false);
          setJobError(null);
        }}
        onConfirm={(job) => void changeJob(job)}
      />
      <OfflineDialog
        summary={summary}
        stageName={scene.stageName}
        onClose={() => setSummary(null)}
        onAllocate={() => {
          setSummary(null);
          setTab("character");
        }}
      />
    </div>
  );
}

function agoLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "剛剛";
  if (s < 60) return `${s} 秒前`;
  return `${Math.floor(s / 60)} 分鐘前`;
}
