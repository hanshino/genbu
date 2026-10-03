"use client";

import { useState } from "react";
import {
  ImportIcon,
  InfoIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ImportStatus = "idle" | "pending" | "error";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => Promise<void> | void;
  status: ImportStatus;
  error?: string;
  initialText?: string;
}

const TITLE = "從 tthol-reader 匯入";

export function ImportDialog({ open, onOpenChange, ...form }: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg gap-0 overflow-hidden p-0">
        {/* ponytail: Popup 關閉即卸載，輸入框狀態跟著重置；錯誤時 Dialog 仍開著所以內容會保留 */}
        <ImportForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}

function ImportForm({
  onSubmit,
  status,
  error,
  initialText,
  onCancel,
}: Omit<ImportDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [text, setText] = useState(initialText ?? "");
  const pending = status === "pending";
  const failed = status === "error";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && !pending) void onSubmit(text.trim());
      }}
    >
      <header className="flex items-center gap-2.5 border-b border-border/60 px-5 pt-4 pb-3.5">
        <ImportIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <DialogTitle className="font-heading text-[15px]">{TITLE}</DialogTitle>
      </header>
      <DialogCloseButton className="top-3.5 right-4" />

      <div className="px-5 pt-4 pb-4">
        <label htmlFor="import-text" className="mb-1.5 block text-xs font-medium">
          貼上匯入字串
        </label>
        <Textarea
          id="import-text"
          autoFocus
          spellCheck={false}
          value={text}
          readOnly={pending}
          onChange={(e) => setText(e.target.value)}
          placeholder="貼上 TTHOL1. 開頭的字串，或整段連結都可以"
          aria-invalid={failed || undefined}
          aria-describedby={failed && error ? "import-error" : undefined}
          className="max-h-48 min-h-24 resize-y font-mono text-xs leading-relaxed break-all placeholder:font-sans md:text-xs"
        />

        {pending ? (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"
          >
            <LoaderCircleIcon className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden />
            正在讀字串，整理門派、裝備和被動…
          </div>
        ) : failed && error ? (
          <div
            id="import-error"
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed font-medium text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </div>
        ) : (
          <p className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
            <span>
              在 tthol-reader 的角色頁按
              <b className="mx-0.5 font-medium text-foreground">「複製到配裝模擬器」</b>
              ，就會把字串複製到剪貼簿。整段網址直接貼也可以，會自動抓出後面的部分。
            </span>
          </p>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
        <span className="min-w-0 text-[11px] text-muted-foreground">
          {failed ? "貼上的內容會保留，" : ""}匯入會新增一隻角色，不會覆蓋現有角色
        </span>
        <span className="ml-auto flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" size="sm" disabled={!text.trim() || pending}>
            {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {pending ? "匯入中" : failed ? "重新匯入" : "匯入"}
          </Button>
        </span>
      </footer>
    </form>
  );
}

/** 角色列「新增」旁邊那顆。 */
export function ImportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" variant="outline" disabled={disabled} onClick={onClick}>
      <ImportIcon />
      匯入
    </Button>
  );
}

/** 還沒有任何角色時的入口。 */
export function ImportEmptyState({
  onCreate,
  onImport,
  className,
}: {
  onCreate: () => void;
  onImport: () => void;
  className?: string;
}) {
  return (
    <section
      aria-label="還沒有任何角色"
      className={cn(
        "rounded-xl border border-dashed border-border bg-card px-5 py-6 text-center",
        className,
      )}
    >
      <UsersIcon
        className="mx-auto mb-2.5 size-6 text-muted-foreground/70"
        strokeWidth={1.5}
        aria-hidden
      />
      <h3 className="mb-1 font-heading text-sm font-semibold">還沒有任何角色</h3>
      <p className="mx-auto max-w-[30em] text-xs leading-relaxed text-muted-foreground">
        可以從頭建一隻，或把 tthol-reader 上的角色直接帶進來，省去一格一格填裝備的功夫。
      </p>
      <div className="mt-3.5 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={onCreate}>
          <PlusIcon />
          建立新角色
        </Button>
        <Button size="sm" onClick={onImport}>
          <ImportIcon />
          {TITLE}
        </Button>
      </div>
    </section>
  );
}
