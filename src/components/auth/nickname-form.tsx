"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlertIcon, CircleCheckBigIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountUser, IdentityTag } from "@/components/auth/account";

type Status = { kind: "idle" | "saved" | "error"; message?: string };

export function NicknameForm({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(user.nickname);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  const invalid = status.kind === "error";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await response.json();
      if (!response.ok) {
        // 文案一律用後端回的，前端不另外寫一套。
        setStatus({ kind: "error", message: data?.error ?? "無法更新暱稱，請稍後再試。" });
        return;
      }
      setNickname(data.nickname);
      setStatus({ kind: "saved" });
      // navbar 的暱稱來自伺服器，要重抓才會跟著換。
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "連線失敗，請稍後再試。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 sm:mt-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium">
            暱稱
          </label>

          <div className="flex items-center gap-2">
            <Input
              id="nickname"
              name="nickname"
              value={nickname}
              maxLength={20}
              placeholder="輸入暱稱"
              autoComplete="nickname"
              aria-invalid={invalid || undefined}
              aria-describedby="nickname-hint nickname-status"
              onChange={(event) => {
                setNickname(event.target.value);
                // 一改字就把上一次的結果收掉，別讓「已儲存」留在新內容旁邊。
                if (status.kind !== "idle") setStatus({ kind: "idle" });
              }}
              className="h-10 max-w-xs sm:h-8"
            />
            {/* 窄版辨識碼移到提示行，這裡只在桌機顯示，避免擠壓輸入框。 */}
            <IdentityTag tag={user.tag} className="hidden text-sm sm:inline" />
          </div>

          <p id="nickname-hint" className="text-muted-foreground mt-2 text-xs leading-relaxed">
            <span className="sm:hidden">
              1–20 個字。你的辨識碼是 <IdentityTag tag={user.tag} className="text-foreground" />
              ，由系統產生、不能修改，用來分辨和你同名的玩家。
            </span>
            <span className="hidden sm:inline">
              1–20 個字。後面的 <IdentityTag tag={user.tag} />
              由系統產生、不能修改，用來分辨和你同名的玩家。
            </span>
          </p>

          <p
            id="nickname-status"
            role="status"
            aria-live="polite"
            className="mt-2 flex items-center gap-1.5 text-xs font-medium empty:mt-0"
          >
            {status.kind === "error" && (
              <>
                <CircleAlertIcon className="text-destructive size-3.5 shrink-0" aria-hidden />
                <span className="text-destructive">{status.message}</span>
              </>
            )}
            {status.kind === "saved" && (
              <>
                <CircleCheckBigIcon className="text-chart-2 size-3.5 shrink-0" aria-hidden />
                <span className="text-chart-2">已儲存</span>
              </>
            )}
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="h-10 w-full sm:mt-[1.85rem] sm:h-9 sm:w-auto sm:px-4"
        >
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </form>
  );
}
