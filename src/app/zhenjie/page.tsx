import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StarRating } from "@/components/zhenjie/star-rating";
import { ZhenjieBookList } from "@/components/zhenjie/zhenjie-book-list";
import {
  ZHENJIE_BONUSES,
  ZHENJIE_OFFICIAL_MAX_M,
  formatZhenjieValue,
  zhenjieBonusValue,
} from "@/configs/zhenjie";
import { getItemIconMap } from "@/lib/queries/images";
import { getZhenjieBooks, getZhenjieTiers } from "@/lib/queries/zhenjie";
import { distinctLineDistribution } from "@/lib/zhenjie";

export const metadata: Metadata = {
  title: "真解 · 玄武",
  description: "全部 70 本真解的星數、強度範圍、8 種加成的數值區間與條數機率",
  alternates: { canonical: "/zhenjie" },
};

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export default function ZhenjiePage() {
  const books = getZhenjieBooks();
  const icons = Object.fromEntries(getItemIconMap(books.map((b) => b.id)));

  const tiers = getZhenjieTiers(books);

  // 全部真解的抽取設定相同（2..4 次、8 條等權重），以第一本計算條數機率。
  const sample = books[0];
  const distribution = distinctLineDistribution(
    sample.modCountMin,
    sample.modCountMax,
    sample.lineWeights.length,
    sample.lineWeights[0],
    sample.noneWeight,
  );
  const linePercent = sample.lineWeights[0] / 10000;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">真解</h1>
        <p className="text-sm text-muted-foreground">
          {books.length} 本真解 · 使用後強化對應技能，加成條數與數值隨機
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>機制</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            <li>
              每本真解抽 {sample.modCountMin}~{sample.modCountMax} 次，每次從 8 種加成中各{" "}
              {linePercent}% 抽一種。抽到重複的不會疊加，所以實際條數可能少於抽的次數。
            </li>
            <li>
              另外會骰一個「強度」，所有加成的數值都由強度決定。強度範圍由書的星數決定，星數越高範圍越高。
            </li>
            <li>星數是這本書固定的等級，不管骰到多少，同一本書顯示的星數都一樣。</li>
          </ul>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">實際條數機率</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {distribution.map((p, count) =>
                count === 0 || count > sample.modCountMax ? null : (
                  <div
                    key={count}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="text-xs text-muted-foreground">{count} 條</div>
                    <div className="font-mono text-lg">{formatPercent(p)}</div>
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">各星數的數值範圍</h2>
            <div className="rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>加成</TableHead>
                    {tiers.map((t) => (
                      <TableHead key={t.stars} className="text-right">
                        <span className="flex flex-col items-end gap-0.5 py-1">
                          <StarRating stars={t.stars} className="[&_svg]:size-3" />
                          <span className="font-mono text-xs font-normal">
                            強度 {t.strengthMin}~{t.strengthMax}
                          </span>
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ZHENJIE_BONUSES.map((def) => (
                    <TableRow key={def.token}>
                      <TableCell className="font-medium">{def.label}</TableCell>
                      {tiers.map((t) => (
                        <TableCell key={t.stars} className="text-right font-mono text-xs">
                          {formatZhenjieValue(zhenjieBonusValue(t.strengthMin, def), def.unit)}
                          {" ~ "}
                          {formatZhenjieValue(zhenjieBonusValue(t.strengthMax, def), def.unit)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              數值 = 強度 × 係數後無條件捨去，最少為 1。技能倍率以「倍」表示，例如 0.62 倍。
            </p>
          </section>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">真解一覽</h2>
        <ZhenjieBookList books={books} icons={icons} />
      </section>

      <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <p>
          強度範圍取自遊戲設定檔。官方更新公告寫的上限是強度 {ZHENJIE_OFFICIAL_MAX_M}（例如技能傷害{" "}
          {zhenjieBonusValue(ZHENJIE_OFFICIAL_MAX_M, ZHENJIE_BONUSES[1]).toLocaleString()}
          ），比設定檔的最高值還高，官方伺服器的實際範圍可能不同。
        </p>
        <p>
          條數機率是推測值：假設抽取次數在範圍內平均分布，官方實際抽法無法從客戶端得知。真解加成只對該書對應的技能有效。
        </p>
        <p>
          說明框中最多一條加成會顯示為「-」。間隔時間、施放時間的「+」字面上是增加毫秒，實際效果官方沒有說明。
        </p>
      </div>
    </div>
  );
}
