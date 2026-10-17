"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioOption } from "@/components/ui/radio-group";
import { JOB_CHANGE_LEVEL } from "@/configs/idle";
import type { JobChoice } from "@/lib/idle/job";
import type { IdleGender } from "@/lib/idle/types";
import { getJobs } from "./api";

/** 預覽動作圖的第 0 格：電腦版放大 2 倍，手機維持原尺寸（像素圖，不做平滑）。 */
function JobSprite({ sprite }: { sprite: NonNullable<JobChoice["sprite"]> }) {
  return (
    <span
      aria-hidden
      className="bg-muted/60 relative block h-[92px] w-[64px] shrink-0 overflow-hidden rounded-md sm:h-[184px] sm:w-full"
    >
      <span
        className="absolute bottom-2 left-1/2 block origin-bottom -translate-x-1/2 scale-100 sm:scale-200"
        style={{
          width: sprite.cellW,
          height: sprite.cellH,
          backgroundImage: `url(${sprite.url})`,
          backgroundSize: `${sprite.cellW * sprite.frames}px ${sprite.cellH}px`,
          backgroundPosition: "0 0",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}

function JobCard({ job }: { job: JobChoice }) {
  // 第一個流派是預設；第二個開放了才提示。
  const other = job.styles.find((style, i) => i > 0 && style.enabled);
  return (
    <RadioOption
      value={job.sectId}
      className="group/job relative h-full items-stretch justify-start rounded-lg p-3 sm:p-3.5 [&>span]:w-full"
    >
      <span className="bg-primary text-primary-foreground absolute top-2 right-2 z-10 hidden size-5 place-items-center rounded-full group-data-[checked]/job:grid">
        <CheckIcon className="size-3.5" aria-hidden />
      </span>
      <span className="flex gap-3 sm:flex-col">
        {job.sprite ? <JobSprite sprite={job.sprite} /> : null}
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex flex-col gap-0.5">
            <span className="font-heading text-lg leading-tight font-bold">{job.sectName}</span>
            <span className="text-muted-foreground text-[13px]">武器　{job.weaponName}</span>
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">代表招式</span>
            {job.skills.map((skill) => (
              <span key={skill.name} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{skill.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  Lv{skill.learnLevel}
                </span>
              </span>
            ))}
          </span>
          {other && (
            <span className="text-muted-foreground text-xs leading-relaxed">
              也可改用{other.weaponShort}練{other.label}
            </span>
          )}
        </span>
      </span>
    </RadioOption>
  );
}

/** 領到轉職證書後選門派。第一次開啟才向伺服器要三個門派的資料。 */
export function JobDialog({
  open,
  gender,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  gender: IdleGender;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (job: JobChoice) => void;
}) {
  const [jobs, setJobs] = useState<JobChoice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (!open || jobs) return;
    let cancelled = false;
    void getJobs(gender).then((res) => {
      if (cancelled) return;
      if (res.ok) setJobs(res.body.jobs);
      else setLoadError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, gender, jobs, attempt]);

  const chosen = jobs?.find((job) => job.sectId === picked) ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogPopup className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">獲得轉職證書</DialogTitle>
          <DialogDescription>已經 {JOB_CHANGE_LEVEL} 級了，選一個門派拜師吧。</DialogDescription>
        </DialogHeader>

        {jobs ? (
          <RadioGroup<number>
            aria-label="選擇門派"
            onValueChange={(value) => setPicked(value)}
            disabled={busy}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {jobs.map((job) => (
              <JobCard key={job.sectId} job={job} />
            ))}
          </RadioGroup>
        ) : loadError ? (
          <div
            role="alert"
            className="border-border/60 flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm"
          >
            <p className="text-destructive min-w-0 flex-1">{loadError}</p>
            <Button
              variant="outline"
              onClick={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
              }}
            >
              重試
            </Button>
          </div>
        ) : (
          <div
            role="status"
            aria-label="載入門派資料中"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-muted/50 h-28 rounded-lg motion-safe:animate-pulse sm:h-[360px]"
              />
            ))}
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          拜師後外觀、武器和技能會換成該門派的，之後不能再更換。
        </p>
        {error && (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {error}
          </p>
        )}

        <DialogFooter className="flex-wrap">
          <Button variant="outline" className="h-11 px-4" disabled={busy} onClick={onClose}>
            稍後
          </Button>
          <Button
            className="h-11 px-4"
            disabled={!chosen || busy}
            onClick={() => chosen && onConfirm(chosen)}
          >
            拜入門下
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
