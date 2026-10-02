"use client";

import { useState } from "react";
import {
  CopyIcon,
  HardDriveIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SECTS } from "@/configs/stat-sim";
import type { useCharacters } from "@/lib/hooks/use-characters";

type Store = ReturnType<typeof useCharacters>;

const LOAD_ERRORS = {
  corrupt: "這台裝置上的角色存檔讀不出來（格式損壞）。重設前不會覆蓋原本的存檔。",
  "unknown-version": "角色存檔是較新版本的格式，這個頁面看不懂。重設前不會覆蓋原本的存檔。",
  "storage-failed": "瀏覽器不允許讀取本機儲存（可能是無痕模式或停用網站資料），修改不會被保存。",
} as const;

export function CharacterBar({ store }: { store: Store }) {
  const { active } = store;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <section aria-label="角色切換" className="mb-5 space-y-2">
      {store.error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{LOAD_ERRORS[store.error]}</span>
          {store.error !== "storage-failed" && (
            <Button size="sm" variant="outline" onClick={store.resetCorrupt}>
              重設角色資料
            </Button>
          )}
        </div>
      )}
      {store.saveFailed && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          無法存到這台裝置（儲存空間可能已滿），這次的修改關掉頁面就會消失。
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-foreground/10">
        {store.store.characters.length > 0 && (
          <ToggleGroup
            aria-label="角色"
            className="flex-wrap border-0 bg-transparent p-0"
            value={active ? [active.id] : []}
            onValueChange={(v) => v[0] && store.select(v[0])}
          >
            {store.store.characters.map((c) => (
              <ToggleGroupItem
                key={c.id}
                value={c.id}
                size="stacked"
                className="border-border/60 bg-secondary data-pressed:border-primary/40 data-pressed:bg-primary/[0.08]"
              >
                <span className="font-medium">{c.name || "未命名"}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {SECTS[c.sectId].name} · <span className="font-mono">Lv{c.level}</span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={!store.loaded}
            onClick={() => store.create()}
          >
            <PlusIcon />
            新增
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!active}
            onClick={() => active && store.duplicate(active.id)}
          >
            <CopyIcon />
            複製
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="改名"
            title="改名"
            disabled={!active}
            onClick={() => active && setRenaming(active.name)}
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="刪除角色"
            title="刪除角色"
            disabled={!active}
            onClick={() => setDeleting(true)}
          >
            <Trash2Icon />
          </Button>
          <span className="ml-1 hidden items-center gap-1.5 border-l border-border/60 pl-3 text-xs text-muted-foreground sm:inline-flex">
            <HardDriveIcon className="size-3.5" aria-hidden />
            自動存在這台裝置
          </span>
        </div>
      </div>

      <Dialog open={renaming != null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogPopup>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = renaming?.trim();
              if (active && name) store.rename(active.id, name);
              setRenaming(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>角色改名</DialogTitle>
            </DialogHeader>
            <DialogCloseButton />
            <Input
              autoFocus
              aria-label="角色名稱"
              maxLength={20}
              value={renaming ?? ""}
              onChange={(e) => setRenaming(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                取消
              </Button>
              <Button type="submit" disabled={!renaming?.trim()}>
                儲存
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>刪除「{active?.name}」？</DialogTitle>
            <DialogDescription>
              刪除後無法復原，這隻角色的配點、裝備和被動設定都會一起移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (active) store.remove(active.id);
                setDeleting(false);
              }}
            >
              刪除
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
