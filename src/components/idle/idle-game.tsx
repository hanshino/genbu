"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IdleState, IdleSummary } from "@/lib/idle/types";
import type { IdleCreateAssets } from "@/lib/queries/idle";
import { getCreateAssets, getIdleData, getSave, type IdleBoot, type IdleView } from "./api";
import { CharacterCreate } from "./character-create";
import { IdlePlayer } from "./idle-player";
import { IdleLoginPrompt } from "./login-prompt";

type Phase =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "no-save"; assets: IdleCreateAssets }
  | { kind: "error"; message: string }
  | { kind: "ready"; state: IdleState; offline: IdleSummary | null; boot: IdleBoot; notice: string | null };

/** 載入存檔與引擎資料，再交給 IdlePlayer。 */
export function IdleGame() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // 轉職後重新載入時，要放進戰鬥紀錄的第一行。
  const pendingNotice = useRef<string | null>(null);

  /** 有存檔（讀到的或剛建立的）：載入引擎與場景資料後開始遊戲。 */
  const enter = useCallback(async (view: IdleView) => {
    const boot = await getIdleData(view.state.presetId, view.state.weaponItemId);
    if (!boot.ok) {
      setPhase({ kind: "error", message: boot.error });
      return;
    }
    const notice = pendingNotice.current;
    pendingNotice.current = null;
    setPhase({ kind: "ready", state: view.state, offline: view.offlineSummary ?? null, boot: boot.body, notice });
  }, []);

  const load = useCallback(async () => {
    const saved = await getSave();
    if (!saved.ok) {
      setPhase(saved.status === 401 ? { kind: "login" } : { kind: "error", message: saved.error });
      return;
    }
    if (saved.body.state === null) {
      const assets = await getCreateAssets();
      setPhase(assets.ok ? { kind: "no-save", assets: assets.body } : { kind: "error", message: assets.error });
      return;
    }
    await enter(saved.body as IdleView);
  }, [enter]);

  const reload = useCallback((notice: string | null) => {
    pendingNotice.current = notice;
    setPhase({ kind: "loading" });
    setAttempt((n) => n + 1);
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
      return (
        <CharacterCreate
          assets={phase.assets}
          onCreated={(view) => {
            setPhase({ kind: "loading" });
            void enter(view);
          }}
          onExists={() => {
            setPhase({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
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
      return (
        <IdlePlayer initial={phase.state} offline={phase.offline} boot={phase.boot} notice={phase.notice} onReload={reload} />
      );
  }
}
