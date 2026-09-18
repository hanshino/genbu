"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckBigIcon,
  CoinsIcon,
  InfoIcon,
  LockIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AccountUser, IdentityBlock, IdentityTag, loginHref } from "@/components/auth/account";
import { LineIcon } from "@/components/auth/line-icon";
import type { CurrencyId, PriceReport, ServerId } from "@/lib/queries/market-prices";
import {
  CURRENCY_LABELS,
  SERVERS,
  SILVER_PER_WAN,
  formatAmount,
  formatReference,
  formatSilver,
  referencePrice,
  relativeTime,
} from "@/lib/market-price";
import { useTwdRate } from "@/lib/hooks/use-twd-rate";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

const CURRENCIES: CurrencyId[] = ["silver", "official", "twd"];

/** 回報表單的輸入單位：銀兩是遊戲裡最小的那一元，照原值收。 */
const INPUT_UNITS: Record<CurrencyId, string> = {
  silver: "銀兩",
  official: "官幣",
  twd: "台幣",
};

type Status = { kind: "error" | "ok"; message: string } | null;

export function MarketPriceSection({
  itemId,
  itemName,
  user,
}: {
  itemId: number;
  itemName: string;
  user: AccountUser | null;
}) {
  const returnTo = usePathname();
  const [reports, setReports] = useState<PriceReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [server, setServer] = useState<ServerId>("fish");
  const [currency, setCurrency] = useState<CurrencyId>("silver");
  const [rate, setRate] = useTwdRate();
  const [status, setStatus] = useState<Status>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/items/${itemId}/prices`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setReports(data.reports as PriceReport[]);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [itemId]);

  // 市價不進頁面的靜態快取，掛載後才自己抓。
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const rows = (reports ?? []).filter((r) => r.server === server);
  const reference = referencePrice(reports ?? [], server, rate);
  const price = formatReference(reference.silver, currency, rate);
  const rateText = rate == null ? null : formatSilver(rate);
  const serverName = SERVERS.find((s) => s.id === server)!.name;
  // 正在看台幣卻沒設匯率：主數字是「—」，得給個出口。
  const needsRate = currency === "twd" && rate == null;

  async function vote(report: PriceReport, value: 1 | -1) {
    if (!user) {
      setStatus({ kind: "error", message: "登入後才能為回報投票。" });
      return;
    }
    const next = report.myVote === value ? 0 : value;
    try {
      const response = await fetch(`/api/reports/${report.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ kind: "error", message: data?.error ?? "投票失敗，請稍後再試。" });
        return;
      }
      setStatus(null);
      track("price_vote", { direction: next === 0 ? "cancel" : next === 1 ? "up" : "down" });
      setReports((prev) =>
        (prev ?? []).map((r) =>
          r.id === report.id ? { ...r, netVotes: data.netVotes, myVote: next } : r,
        ),
      );
    } catch {
      setStatus({ kind: "error", message: "連線失敗，請稍後再試。" });
    }
  }

  async function remove(report: PriceReport) {
    // ponytail: 原生 confirm 就擋得住誤觸，要換成 AlertDialog 再說。
    if (!window.confirm("刪除這筆回報？刪掉就救不回來了。")) return;
    try {
      const response = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ kind: "error", message: data?.error ?? "刪除失敗，請稍後再試。" });
        return;
      }
      setStatus({ kind: "ok", message: "已刪除這筆回報。" });
      void load();
    } catch {
      setStatus({ kind: "error", message: "連線失敗，請稍後再試。" });
    }
  }

  return (
    <section
      aria-labelledby="market-price"
      className="rounded-lg border border-border/60 bg-card p-4"
    >
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="market-price" className="text-sm font-medium">
            玩家回報市價
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">價格由玩家自己回報，僅供參考。</p>
        </div>

        <ToggleGroup
          aria-label="伺服器"
          value={[server]}
          onValueChange={(value) => {
            if (value[0]) setServer(value[0] as ServerId);
          }}
          className="max-sm:w-full"
        >
          {SERVERS.map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              size="stacked"
              className="max-sm:flex-1 max-sm:items-center"
            >
              {s.name}
              <span className="text-[11px] font-normal opacity-75">{s.alias}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* 參考價：整個區塊唯一用朱砂的地方，左側細線 + 數字，其餘全走墨階。 */}
      <div
        role="group"
        aria-label="參考價"
        className="rounded-lg border border-border/60 border-l-[3px] border-l-primary bg-muted px-4 py-4 sm:px-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">參考價 · {serverName}</div>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <span className="font-heading text-[34px] leading-none font-semibold tracking-tight text-primary tabular-nums sm:text-[42px]">
                {price.value}
              </span>
              <span className="font-heading pb-0.5 text-base font-semibold text-primary sm:text-[17px]">
                {price.unit}
              </span>
            </div>
          </div>

          <ToggleGroup
            aria-label="幣別"
            value={[currency]}
            onValueChange={(value) => {
              if (value[0]) setCurrency(value[0] as CurrencyId);
            }}
            className="bg-secondary/80 max-sm:w-full"
          >
            {CURRENCIES.map((c) => (
              <ToggleGroupItem key={c} value={c} size="sm" className="max-sm:flex-1">
                {CURRENCY_LABELS[c]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {needsRate
            ? "設定台幣匯率後才看得到台幣金額。"
            : reference.silver == null
              ? `${serverName}目前沒有可用的回報。`
              : `由 ${reference.count} 筆回報算出 · 取近 30 天、認同數不為負的回報中位數`}
        </p>

        {/* 有現金報價、或正看著台幣卻沒設匯率，都要留一個設定入口，不能走進死路。 */}
        {(reference.cash > 0 || needsRate) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0" aria-hidden />
            <span>
              {rateText
                ? `已照 1 台幣 = ${rateText.value} ${rateText.unit}換算，現金報價已算進來`
                : reference.cash > 0
                  ? `另有 ${reference.cash} 筆現金報價未納入計算`
                  : "還沒設過台幣匯率"}
            </span>
            <RatePopover rate={rate} onSave={setRate} />
          </div>
        )}
      </div>

      <Separator className="my-3.5" />

      {reports == null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {loadError ? "無法載入市價資料，請重新整理頁面。" : "載入市價資料…"}
        </p>
      ) : reports.length === 0 ? (
        <EmptyState itemName={itemName} onReport={() => amountRef.current?.focus()} user={user} />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-medium">最近的回報</h3>
            <span className="text-xs text-muted-foreground">依認同數排序</span>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {serverName}還沒有人回報，但另一個伺服器有。
            </p>
          ) : (
            <ul className="mt-1.5">
              {rows.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  rate={rate}
                  loggedIn={user != null}
                  onVote={vote}
                  onDelete={remove}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {status && (
        <p
          role="status"
          className={cn(
            "mt-3 flex items-center gap-1.5 text-xs font-medium",
            status.kind === "error" ? "text-destructive" : "text-chart-2",
          )}
        >
          {status.kind === "error" ? (
            <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <CircleCheckBigIcon className="size-3.5 shrink-0" aria-hidden />
          )}
          {status.message}
          {!user && status.kind === "error" && (
            <a href={loginHref(returnTo)} className="text-primary underline underline-offset-3">
              前往登入
            </a>
          )}
        </p>
      )}

      <Separator className="my-3.5" />

      {user ? (
        <ReportForm
          itemId={itemId}
          server={server}
          onServerChange={setServer}
          amountRef={amountRef}
          onReported={() => {
            setStatus({ kind: "ok", message: "已送出，感謝回報。" });
            void load();
          }}
          onError={(message) => setStatus({ kind: "error", message })}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm">登入後可以回報價格，也能幫別人的報價按讚或倒讚。</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              站上不會顯示你的 LINE 名字，只顯示你自己設的暱稱加末五碼。
            </p>
          </div>
          {/* LINE 綠是全站唯一的品牌色例外，跟登入頁一致。 */}
          <a
            href={loginHref(returnTo)}
            onClick={() => track("login_start", { source: "market_price" })}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 text-sm font-medium text-white shadow-sm transition-colors outline-none hover:bg-[#05A948] focus-visible:ring-3 focus-visible:ring-[#06C755]/45 active:translate-y-px max-sm:w-full"
          >
            <LineIcon className="size-4" />
            使用 LINE 登入
          </a>
        </div>
      )}
    </section>
  );
}

function ReportRow({
  report,
  rate,
  loggedIn,
  onVote,
  onDelete,
}: {
  report: PriceReport;
  rate: number | null;
  loggedIn: boolean;
  onVote: (report: PriceReport, value: 1 | -1) => void;
  onDelete: (report: PriceReport) => void;
}) {
  const disputed = report.netVotes < 0;
  const amount = formatAmount(report.amount, report.currency);
  // 台幣沒設匯率時這筆沒進中位數，講明白比默默略過好。
  const excluded = report.currency === "twd" && rate == null;

  return (
    <li className="border-t border-border/60 first:border-t-0">
      <div
        className={cn(
          "flex items-center gap-3 py-3 transition-opacity",
          disputed && "opacity-60 hover:opacity-100",
        )}
      >
        <IdentityBlock nickname={report.nickname} tag={report.tag} />

        <div className="min-w-0 flex-1">
          <div className="font-heading text-lg leading-tight font-semibold tabular-nums">
            {amount.value}
            <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
              {amount.unit}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="text-foreground">{report.nickname}</span>
            <IdentityTag tag={report.tag} className="text-[11px]" />
            <span aria-hidden>·</span>
            <span>{relativeTime(report.createdAt)}</span>
            {excluded && <Badge variant="outline">未納入計算</Badge>}
            {disputed && (
              <Badge variant="destructive">
                <TriangleAlertIcon aria-hidden />
                有爭議
              </Badge>
            )}
          </div>
        </div>

        {/* 自己的回報投不了票（後端也擋），那兩顆按鈕換成刪除，不留按了就報錯的東西。 */}
        <div className="flex shrink-0 items-center">
          {!report.mine && (
            <VoteButton
              direction={1}
              active={report.myVote === 1}
              loggedIn={loggedIn}
              onClick={() => onVote(report, 1)}
            />
          )}
          <span
            className={cn(
              "min-w-8 text-center text-sm tabular-nums",
              report.netVotes > 0
                ? "font-medium text-foreground"
                : report.netVotes < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {report.netVotes > 0 ? `+${report.netVotes}` : report.netVotes}
          </span>
          {report.mine ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="刪除我的回報"
              onClick={() => onDelete(report)}
              className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-8"
            >
              <Trash2Icon aria-hidden />
            </Button>
          ) : (
            <VoteButton
              direction={-1}
              active={report.myVote === -1}
              loggedIn={loggedIn}
              onClick={() => onVote(report, -1)}
            />
          )}
        </div>
      </div>
    </li>
  );
}

/** 窄版 44px 是為了手指點得到；桌機縮回 32px 免得跟金額搶版面。 */
function VoteButton({
  direction,
  active,
  loggedIn,
  onClick,
}: {
  direction: 1 | -1;
  active: boolean;
  loggedIn: boolean;
  onClick: () => void;
}) {
  const up = direction === 1;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={loggedIn ? active : undefined}
      aria-label={up ? "認同這筆回報" : "不認同這筆回報"}
      onClick={onClick}
      className={cn(
        "size-11 text-muted-foreground sm:size-8",
        active &&
          (up
            ? "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-destructive/30 bg-destructive/8 text-destructive hover:bg-destructive/15"),
      )}
    >
      {up ? <ThumbsUpIcon aria-hidden /> : <ThumbsDownIcon aria-hidden />}
    </Button>
  );
}

function ReportForm({
  itemId,
  server,
  onServerChange,
  amountRef,
  onReported,
  onError,
}: {
  itemId: number;
  server: ServerId;
  onServerChange: (server: ServerId) => void;
  amountRef: React.RefObject<HTMLInputElement | null>;
  onReported: () => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyId>("silver");
  const [sending, setSending] = useState(false);

  // 銀兩照原值收，位數一多就難讀，超過一萬時把萬／億回放出來對眼睛。
  const typed = Number(amount);
  const preview = currency === "silver" && typed >= SILVER_PER_WAN ? formatSilver(typed) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = Number(amount);
    if (!Number.isFinite(input) || input <= 0) {
      onError("請填寫大於 0 的金額。");
      amountRef.current?.focus();
      return;
    }
    const value = Math.round(input);

    setSending(true);
    try {
      const response = await fetch(`/api/items/${itemId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, currency, server }),
      });
      const data = await response.json();
      if (!response.ok) {
        onError(data?.error ?? "無法送出回報，請稍後再試。");
        return;
      }
      setAmount("");
      track("price_report", { server, currency });
      onReported();
    } catch {
      onError("連線失敗，請稍後再試。");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium">回報你看到的價格</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">你在哪個伺服器買賣到的，就填哪個。</p>

      <form
        onSubmit={submit}
        className="mt-3 grid grid-cols-2 items-end gap-2.5 sm:grid-cols-[minmax(0,1fr)_7.5rem_9rem_auto]"
      >
        <div className="col-span-2 sm:col-span-1">
          <label
            htmlFor="price-amount"
            className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
          >
            <span>價格（{INPUT_UNITS[currency]}）</span>
            {preview && (
              <span className="tabular-nums">
                = {preview.value} {preview.unit}
              </span>
            )}
          </label>
          <Input
            id="price-amount"
            ref={amountRef}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            placeholder={
              currency === "silver" ? "18500000" : currency === "official" ? "18" : "600"
            }
            onChange={(event) => setAmount(event.target.value)}
            className="h-9 tabular-nums"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">幣別</label>
          <Select
            value={currency}
            onValueChange={(value) => value && setCurrency(value as CurrencyId)}
          >
            <SelectTrigger className="h-9 w-full" aria-label="幣別">
              <SelectValue>{(value) => INPUT_UNITS[value as CurrencyId]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {INPUT_UNITS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">伺服器</label>
          <Select
            value={server}
            onValueChange={(value) => value && onServerChange(value as ServerId)}
          >
            <SelectTrigger className="h-9 w-full" aria-label="伺服器">
              <SelectValue>
                {(value) => SERVERS.find((s) => s.id === value)?.name ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SERVERS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" disabled={sending} className="col-span-2 sm:col-span-1">
          {sending ? "送出中…" : "送出回報"}
        </Button>
      </form>

      {currency === "twd" && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          台幣報價要看的人自己設過匯率才會算進參考價，沒設的人只會看到你填的金額。
        </p>
      )}
    </div>
  );
}

function RatePopover({
  rate,
  onSave,
}: {
  rate: number | null;
  onSave: (silverPerTwd: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(rate == null ? "" : String(rate));
          setInvalid(false);
        }
      }}
    >
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "link", size: "xs" }),
          "h-auto px-0 text-xs underline underline-offset-3",
        )}
      >
        {rate == null ? "設定台幣匯率" : "改匯率"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3.5">
        <PopoverHeader>
          <PopoverTitle className="font-heading text-[13px] font-semibold">
            設定你的台幣匯率
          </PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed">
            用你自己習慣的換算，設完現金報價才會一起算進參考價。
          </PopoverDescription>
        </PopoverHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] whitespace-nowrap text-muted-foreground">1 台幣 =</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft}
            placeholder="25000"
            aria-label="每 1 台幣可換得的銀兩"
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
            }}
            className="h-8 w-28 tabular-nums"
          />
          <span className="text-[13px] whitespace-nowrap text-muted-foreground">銀兩</span>
        </div>

        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <LockIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
          只存在你自己的瀏覽器，不會上傳，也不會動到別人看到的價。
        </p>

        {invalid && <p className="text-xs text-destructive">匯率要填大於 0 的數字。</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const value = Number(draft);
              if (!Number.isFinite(value) || value <= 0) {
                setInvalid(true);
                return;
              }
              onSave(value);
              track("twd_rate_set", { first: rate == null });
              setOpen(false);
            }}
          >
            儲存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmptyState({
  itemName,
  user,
  onReport,
}: {
  itemName: string;
  user: AccountUser | null;
  onReport: () => void;
}) {
  return (
    <div className="px-4 pt-5 pb-4 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-border/60 bg-muted text-primary">
        <CoinsIcon className="size-5" aria-hidden />
      </span>
      <p className="font-heading mt-3 text-[15px] font-semibold">「{itemName}」還沒有人報過價</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        你最近在市集看到多少？隨手丟一筆上來，後面來查的人就有個底。價錢差很多也沒關係，大家會用投票把它喬回來。
      </p>
      {user && (
        <Button type="button" size="lg" onClick={onReport} className="mt-4">
          我來報第一筆
        </Button>
      )}
    </div>
  );
}
