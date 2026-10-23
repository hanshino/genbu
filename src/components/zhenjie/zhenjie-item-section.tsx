import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StarRating } from "@/components/zhenjie/star-rating";
import {
  ZHENJIE_BONUSES,
  formatZhenjieValue,
  zhenjieBonusValue,
  type ZhenjieBonusDef,
} from "@/configs/zhenjie";
import type { ZhenjieBook, ZhenjieTier } from "@/lib/queries/zhenjie";
import { distinctLineDistribution } from "@/lib/zhenjie";
import { cn } from "@/lib/utils";

function rangeText(min: number, max: number, def: ZhenjieBonusDef): string {
  return `${formatZhenjieValue(zhenjieBonusValue(min, def), def.unit)} ~ ${formatZhenjieValue(zhenjieBonusValue(max, def), def.unit)}`;
}

// 星數比較表挑兩條最有感的加成當例子。
const COMPARE_BONUSES = [ZHENJIE_BONUSES[1], ZHENJIE_BONUSES[7]];

/** 真解道具頁的加成說明：取代 item_rand 原表（真解的 min/max 都是 0，看了沒意義）。 */
export function ZhenjieItemSection({ book, tiers }: { book: ZhenjieBook; tiers: ZhenjieTier[] }) {
  const totalWeight = book.lineWeights.reduce((s, w) => s + w, 0) + book.noneWeight;
  const distribution = distinctLineDistribution(
    book.modCountMin,
    book.modCountMax,
    book.lineWeights.length,
    book.lineWeights[0],
    book.noneWeight,
  );
  // 比本書低星、但最高強度超過本書最低強度的星數：骰得好就可能贏過本書骰得差。
  const overlapping = tiers.filter((t) => t.stars < book.stars && t.strengthMax > book.strengthMin);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">真解加成</h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <StarRating stars={book.stars} />
          <span>
            {book.stars} 星 · 強度 <span className="font-mono">{book.strengthMin}~{book.strengthMax}</span>
          </span>
          <span>·</span>
          <span>
            強化技能
            <Link href={`/skills/${book.skillId}`} className="mx-0.5 text-foreground hover:underline">
              【{book.skillName ?? `#${book.skillId}`}】
            </Link>
          </span>
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4 text-sm leading-relaxed">
        這本固定是 {book.stars} 星，星數不會因為骰值改變。使用後會抽 {book.modCountMin}~{book.modCountMax} 次加成（重複抽到不疊加），並在{" "}
        <span className="font-mono">{book.strengthMin}~{book.strengthMax}</span>{" "}
        之間骰一個強度，每條加成的數值都由這個強度算出。強度越高，所有加成一起變高。
      </div>

      <div className="rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>加成</TableHead>
              <TableHead className="text-right">出現機率</TableHead>
              <TableHead className="text-right">本書數值範圍</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ZHENJIE_BONUSES.map((def, i) => (
              <TableRow key={def.token}>
                <TableCell className="font-medium">{def.label}</TableCell>
                <TableCell className="text-right font-mono">
                  {((book.lineWeights[i] / totalWeight) * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-mono">
                  {rangeText(book.strengthMin, book.strengthMax, def)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        「出現機率」是每次抽到該加成的機率。技能倍率以「倍」表示。
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">實際條數機率</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {distribution.map((p, count) =>
            count === 0 || count > book.modCountMax ? null : (
              <div key={count} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="text-xs text-muted-foreground">{count} 條</div>
                <div className="font-mono text-lg">{(p * 100).toFixed(1)}%</div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">和其他星數的真解比較</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          每本真解的星數是固定的，下表其他星數是別本真解，不是這本能升到的等級。星數只決定強度範圍：星數越高，強度的上下限越高；抽幾條、抽到哪種加成的機率，各星數都一樣。
          {overlapping.length > 0 && (
            <>
              {" "}
              強度範圍互有重疊，例如 {overlapping.at(-1)!.stars} 星的書最高可到{" "}
              {overlapping.at(-1)!.strengthMax}，骰得好會贏過這本骰到 {book.strengthMin} 的情況。
            </>
          )}
        </p>
        <div className="rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>星數</TableHead>
                <TableHead className="text-right">強度範圍</TableHead>
                <TableHead className="text-right">本數</TableHead>
                {COMPARE_BONUSES.map((def) => (
                  <TableHead key={def.token} className="text-right">
                    {def.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((t) => {
                const current = t.stars === book.stars;
                return (
                  <TableRow key={t.stars} className={cn(current && "bg-muted/50")}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <StarRating stars={t.stars} />
                        {current && <Badge variant="secondary">本書</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t.strengthMin}~{t.strengthMax}
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.bookCount}</TableCell>
                    {COMPARE_BONUSES.map((def) => (
                      <TableCell key={def.token} className="text-right font-mono">
                        {rangeText(t.strengthMin, t.strengthMax, def)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Link
        href="/zhenjie"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground"
      >
        看全部真解與各星數的完整數值
        <ChevronRightIcon className="size-3.5" aria-hidden />
      </Link>

      <p className="text-xs leading-relaxed text-muted-foreground">
        強度範圍取自遊戲設定檔，官方公告的上限是強度 200，官方伺服器實際範圍可能不同。條數機率假設抽取次數平均分布，屬推測值。
      </p>
    </section>
  );
}
