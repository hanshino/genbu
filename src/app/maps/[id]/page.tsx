import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { StageFlagBadge } from "@/components/maps/stage-flag-badge";
import { sortStageFlags } from "@/lib/constants/stage-flags";
import { getStageDetail } from "@/lib/queries/stages";
import type { InboundLink, StageDetail, StageMissionRef } from "@/lib/types/stage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const stageId = Number(id);
  if (!Number.isInteger(stageId) || stageId <= 0) return { title: "地圖 · 玄武" };
  const stage = getStageDetail(stageId);
  if (!stage) return { title: "地圖不存在 · 玄武" };
  return {
    title: `${stage.name ?? `地圖 ${stage.id}`} · 地圖 · 玄武`,
    description: `${stage.name} 的屬性、入口、相關任務`,
  };
}

const VIA_LABEL: Record<InboundLink["via"][number], string> = {
  appear_map1: "預設入口 1",
  appear_map2: "預設入口 2",
  logout_map: "登出回到此處",
};

function MapLink({
  id,
  name,
  fallback,
}: {
  id: number | null | undefined;
  name: string | null;
  fallback?: string;
}) {
  if (!id || id === 0) return <span className="text-muted-foreground">{fallback ?? "—"}</span>;
  return (
    <Link
      href={`/maps/${id}`}
      className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {name ?? `#${id}`}
    </Link>
  );
}

function PropertiesGrid({ stage }: { stage: StageDetail }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [];

  if (stage.appear_map1 || stage.appear_map2) {
    if (stage.appear_map1)
      rows.push({
        label: "預設入口 1",
        value: (
          <>
            <MapLink id={stage.appear_map1} name={stage.appearMap1Name} />
            {stage.appear_tag1 != null && stage.appear_tag1 !== 0 && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                tag {stage.appear_tag1}
              </span>
            )}
          </>
        ),
      });
    if (stage.appear_map2)
      rows.push({
        label: "預設入口 2",
        value: (
          <>
            <MapLink id={stage.appear_map2} name={stage.appearMap2Name} />
            {stage.appear_tag2 != null && stage.appear_tag2 !== 0 && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                tag {stage.appear_tag2}
              </span>
            )}
          </>
        ),
      });
  }
  if (stage.logout_map)
    rows.push({
      label: "登出回到",
      value: <MapLink id={stage.logout_map} name={stage.logoutMapName} />,
    });
  if (stage.safe_tag != null && stage.safe_tag !== 0)
    rows.push({
      label: "復活點 tag",
      value: <span className="font-mono text-sm">{stage.safe_tag}</span>,
    });
  if (stage.cave_tag != null && stage.cave_tag !== 0)
    rows.push({
      label: "洞穴 tag",
      value: <span className="font-mono text-sm">{stage.cave_tag}</span>,
    });

  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-card p-4 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-xs text-muted-foreground sm:py-0.5">{r.label}</dt>
          <dd className="sm:py-0.5">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InboundList({ inbound }: { inbound: InboundLink[] }) {
  if (inbound.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">指向此處的地圖</h2>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {inbound.map((l) => (
          <li
            key={l.fromId}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm"
          >
            <span className="font-mono text-xs text-muted-foreground">
              #{l.fromId}
            </span>
            <Link
              href={`/maps/${l.fromId}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {l.fromName}
            </Link>
            <div className="ml-auto flex flex-wrap gap-1">
              {l.via.map((v) => (
                <Badge key={v} variant="outline" className="font-normal">
                  {VIA_LABEL[v]}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MissionsList({ missions }: { missions: StageMissionRef[] }) {
  if (missions.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">相關任務</h2>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {missions.map((m) => (
          <li key={m.missionId}>
            <Link
              href={`/missions/${m.missionId}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground">
                #{m.missionId}
              </span>
              <span className="font-medium">
                {m.missionName ?? `任務 ${m.missionId}`}
              </span>
              {m.groupId != null && (
                <Badge variant="outline" className="font-normal">
                  分組 #{m.groupId}
                </Badge>
              )}
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                ×{m.refCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function MapDetailPage({ params }: PageProps) {
  const { id } = await params;
  const stageId = Number(id);
  if (!Number.isInteger(stageId) || stageId <= 0) notFound();

  const stage = getStageDetail(stageId);
  if (!stage || !stage.name) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/maps">返回地圖列表</BackLink>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">#{stage.id}</span>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {stage.name}
          </h1>
          {stage.kind === "sestage" && (
            <Badge variant="outline" className="font-normal">
              SE 地圖
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {stage.group != null && (
            <Badge variant="outline" className="font-normal">
              區域 #{stage.group}
            </Badge>
          )}
          {sortStageFlags(stage.flags).map((f) => (
            <StageFlagBadge key={f} flag={f} />
          ))}
        </div>
      </header>

      <PropertiesGrid stage={stage} />

      {stage.groupSiblings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">同區域地圖</h2>
          <div className="flex flex-wrap gap-1.5">
            {stage.groupSiblings.map((s) => (
              <Link
                key={s.id}
                href={`/maps/${s.id}`}
                className="rounded-md border border-border/60 bg-card px-2.5 py-1 text-xs transition-colors hover:bg-muted/50"
              >
                {s.name}
                <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">
                  #{s.id}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <InboundList inbound={stage.inbound} />

      <MissionsList missions={stage.missions} />

      <p className="text-xs text-muted-foreground">
        資料來自 STAGE.INI / SESTAGE.INI；
        appear_map / logout_map 記錄的是「預設出生／登出」的目的地，並非完整的地圖傳送網。
      </p>
    </div>
  );
}
