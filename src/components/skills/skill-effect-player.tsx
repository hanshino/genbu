"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SPEED_OPTIONS,
  hitTicks,
  indexSprites,
  msPerTick,
  totalTicks,
  type EffectGender,
  type SkillEffectBundle,
  type SpeedKey,
} from "@/lib/skill-effect";
import { STAGE_H, STAGE_W, drawScene, requestImage } from "@/components/skills/skill-effect-canvas";

interface SkillEffectPlayerProps {
  /** 技能最低等級那筆的 id（API 與施法者外觀都以它為 key）。 */
  magicId: number;
  genders: EffectGender[];
  presetLabels: Partial<Record<EffectGender, string>>;
}

const GENDER_LABELS: Record<EffectGender, string> = { m: "男", f: "女" };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SkillEffectPlayer({ magicId, genders, presetLabels }: SkillEffectPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [requested, setRequested] = useState(false);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bundle, setBundle] = useState<SkillEffectBundle | null>(null);
  const [failed, setFailed] = useState(false);

  const [gender, setGender] = useState<EffectGender>(genders[0]);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [speed, setSpeed] = useState<SpeedKey>("tick");
  const [kill, setKill] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  // 捲到才載入資料；離開畫面就停掉播放迴圈。
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setRequested(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!requested) return;
    const controller = new AbortController();
    fetch(`/api/skills/${magicId}/effect`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<SkillEffectBundle>;
      })
      .then((data) => {
        setBundle(data);
        setFailed(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [requested, magicId, attempt]);

  const caster = bundle?.casters[gender];
  const total = bundle ? totalTicks(bundle.ticks) : 0;
  const hits = useMemo(() => (bundle ? hitTicks(bundle.frames) : []), [bundle]);
  const sprites = useMemo(() => indexSprites(bundle?.sprites ?? []), [bundle]);

  // 預載目前性別需要的圖，載入完成就重畫。
  useEffect(() => {
    if (!bundle || !caster) return;
    let cancelled = false;
    const onLoad = () => {
      if (!cancelled) setImageVersion((v) => v + 1);
    };
    const urls = new Set<string>();
    for (const strip of Object.values(caster.strips)) urls.add(strip.url);
    for (const strip of Object.values(bundle.target.strips)) urls.add(strip.url);
    for (const sprite of bundle.sprites) urls.add(sprite.url);
    for (const url of urls) requestImage(url, onLoad);
    return () => {
      cancelled = true;
    };
  }, [bundle, caster]);

  // 播放：累積經過的毫秒，湊滿一個 tick 就前進。
  useEffect(() => {
    if (!bundle || !visible || !playing) return;
    const mpt = msPerTick(speed, bundle.tickMs);
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      const steps = Math.floor(acc / mpt);
      if (steps > 0) {
        acc -= steps * mpt;
        setTick((prev) => (prev + steps) % (total + 1));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [bundle, visible, playing, speed, total]);

  // 畫面：tick、性別、擊倒切換、圖片載入完成時重畫。
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !bundle || !caster) return;
    drawScene(ctx, { bundle, sprites, casterStrips: caster.strips, hits, tick, kill });
  }, [bundle, caster, sprites, hits, tick, kill, imageVersion]);

  function changeGender(next: EffectGender) {
    if (next === gender) return;
    setGender(next);
    setTick(0);
  }

  const loading = requested && !bundle && !failed;
  const casterLabel = caster?.label ?? presetLabels[gender];

  return (
    <Card ref={rootRef}>
      <CardHeader>
        <CardTitle>技能演出</CardTitle>
        {genders.length > 1 && (
          <CardAction>
            <ToggleGroup
              aria-label="施法者性別"
              value={[gender]}
              onValueChange={(v) => v[0] && changeGender(v[0] as EffectGender)}
            >
              {genders.map((g) => (
                <ToggleGroupItem key={g} value={g} size="sm">
                  {GENDER_LABELS[g]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-[#0b0e16]">
          <canvas
            ref={canvasRef}
            width={STAGE_W}
            height={STAGE_H}
            aria-label="技能演出畫面"
            className="absolute inset-0 size-full"
          />
          {!bundle && (
            <div
              role={failed ? "alert" : "status"}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0e16] text-sm text-slate-300"
            >
              {failed ? (
                <>
                  <span>演出資料載入失敗。</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFailed(false);
                      setAttempt((n) => n + 1);
                    }}
                  >
                    重試
                  </Button>
                </>
              ) : (
                <span className={loading ? "motion-safe:animate-pulse" : undefined}>載入中…</span>
              )}
            </div>
          )}
        </div>

        {bundle && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label={playing ? "暫停" : "播放"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="重播"
                onClick={() => {
                  setTick(0);
                  setPlaying(true);
                }}
              >
                <RotateCcwIcon />
              </Button>
            </div>

            <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
              <Slider
                aria-label="時間軸"
                min={0}
                max={total}
                step={1}
                value={tick}
                onValueChange={(v) => {
                  setPlaying(false);
                  setTick(Array.isArray(v) ? v[0] : v);
                }}
              />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {tick}/{total}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span id="skill-effect-speed" className="text-muted-foreground">
                速度
              </span>
              <Select value={speed} onValueChange={(v) => v && setSpeed(v as SpeedKey)}>
                <SelectTrigger size="sm" aria-labelledby="skill-effect-speed">
                  <SelectValue>
                    {(v) => SPEED_OPTIONS.find((o) => o.key === v)?.label ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <Checkbox className="size-4" checked={kill} onCheckedChange={(v) => setKill(v === true)} />
              最後擊倒
            </label>
          </div>
        )}

        <div className="space-y-1 text-xs text-muted-foreground">
          {bundle && (
            <p>
              施法者：{casterLabel}　目標：{bundle.target.name}
            </p>
          )}
          <p>模擬重現：時間軸由技能腳本模擬產生，每 tick 長度未經實測，部分特效為近似。</p>
        </div>
      </CardContent>
    </Card>
  );
}
