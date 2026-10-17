"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IdleState, IdleSummary } from "@/lib/idle/types";
import { getIdleData, getSave, type IdleBoot, type IdleView } from "./api";
import { IdlePlayer } from "./idle-player";
import { IdleLoginPrompt } from "./login-prompt";

type Phase =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "no-save" }
  | { kind: "error"; message: string }
  | { kind: "ready"; state: IdleState; offline: IdleSummary | null; boot: IdleBoot };

/** 載入存檔與引擎資料，再交給 IdlePlayer。 */
export function IdleGame() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    const saved = await getSave();
    if (!saved.ok) {
      setPhase(saved.status === 401 ? { kind: "login" } : { kind: "error", message: saved.error });
      return;
    }
    if (saved.body.state === null) {
      setPhase({ kind: "no-save" });
      return;
    }
    const view = saved.body as IdleView;
    const boot = await getIdleData(view.state.presetId);
    if (!boot.ok) {
      setPhase({ kind: "error", message: boot.error });
      return;
    }
    setPhase({ kind: "ready", state: view.state, offline: view.offlineSummary ?? null, boot: boot.body });
  }, []);

  useEffect(() => {
    // 載入完才會 setState；重試時由 attempt 觸發。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, attempt]);

  switch (phase.kind) {
    case "loading":
      return (
        <p role="status" className="text-muted-foreground py-16 text-center text-sm motion-safe:animate-pulse">
          載入存檔中…
        </p>
      );
    case "login":
      return <IdleLoginPrompt />;
    case "no-save":
      // 建立角色畫面還沒做（之後會用遊戲素材重做），先不放任何操作。
      return (
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">角色建立畫面製作中</CardTitle>
            <CardDescription>還沒有存檔。建立角色的畫面完成後，這裡就能開始掛機。</CardDescription>
          </CardHeader>
        </Card>
      );
    case "error":
      return (
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">載入失敗</CardTitle>
            <CardDescription role="alert">{phase.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                setPhase({ kind: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              重試
            </Button>
          </CardContent>
        </Card>
      );
    case "ready":
      return <IdlePlayer initial={phase.state} offline={phase.offline} boot={phase.boot} />;
  }
}
