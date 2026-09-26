import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import { ClockAlertIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";
import { headingId } from "@/lib/guides";
import { getGuideRef, type GuideRefKind } from "@/lib/guide-refs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BoxContents } from "./box-contents";
import { Check, ChecklistRoot } from "./checklist";
import { DungeonStep, StepDone } from "./dungeon-step";
import { GuideRefTag } from "./guide-ref-tag";
import { MissionCard } from "./mission-card";
import { NineRoomGrid, RouteTab, RouteTabs, StepMap, StepTargets } from "./step-map";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/* ── 資料標籤 ── */

type RefProps = { id: number | string; children?: ReactNode };

function RefInline({ kind, id, children }: RefProps & { kind: GuideRefKind }) {
  const data = getGuideRef(kind, Number(id));
  if (!data) return <>{children}</>;
  return <GuideRefTag data={data}>{children}</GuideRefTag>;
}

const Item = (p: RefProps) => <RefInline kind="item" {...p} />;
const MapRef = (p: RefProps) => <RefInline kind="map" {...p} />;
const Monster = (p: RefProps) => <RefInline kind="monster" {...p} />;
const Skill = (p: RefProps) => <RefInline kind="skill" {...p} />;
const Mission = (p: RefProps) => <RefInline kind="mission" {...p} />;

/* ── 提醒框 ── */

function Note({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: string;
  icon: typeof LightbulbIcon;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <aside
      style={{ "--tone": tone } as CSSProperties}
      className="my-5 flex gap-3 rounded-xl border border-(--tone)/30 bg-(--tone)/8 px-4 py-3.5 text-[14.5px] leading-[1.7] [&_p]:mb-0 [&_p]:text-[14.5px] [&_p]:leading-[1.7] [&_p+p]:mt-2"
    >
      <Icon className="mt-1 size-[18px] shrink-0 text-(--tone)" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-heading font-medium">{title}</p>}
        {children}
      </div>
    </aside>
  );
}

const Tip = (p: { title?: string; children?: ReactNode }) => (
  <Note tone="var(--chart-2)" icon={LightbulbIcon} {...p} />
);
const Warning = (p: { title?: string; children?: ReactNode }) => (
  <Note tone="var(--chart-1)" icon={TriangleAlertIcon} {...p} />
);

/** 待作者核對：只給本機寫稿時看，production 不出現。 */
function Verify({ children }: { children?: ReactNode }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <aside className="text-muted-foreground my-4 flex gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] leading-relaxed [&_p]:mb-0 [&_p]:text-[12.5px] [&_p]:leading-relaxed">
      <ClockAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <b className="text-foreground/70 font-medium">待作者核對</b>
        <span className="mx-1.5" aria-hidden />
        {children}
      </div>
    </aside>
  );
}

/* ── 材料清單 ── */

function Checklist({
  storageKey,
  title,
  children,
}: {
  storageKey: string;
  title?: string;
  children?: ReactNode;
}) {
  // 在伺服器端先數好項目，client 初次 render 就有正確的總數
  const labels = Children.toArray(children)
    .filter(isValidElement)
    .map((el) => (el.props as { label?: unknown }).label)
    .filter((l): l is string => typeof l === "string");
  return (
    <ChecklistRoot storageKey={storageKey} title={title} labels={labels}>
      {children}
    </ChecklistRoot>
  );
}

/* ── 階梯步驟 ── */

function Steps({ children }: { children?: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement) as ReactElement<StepProps>[];
  return (
    <ol className="my-5 flex flex-col gap-2.5 sm:flex-row sm:items-stretch sm:pt-5">
      {steps.map((el, i) => cloneElement(el, { n: i }))}
    </ol>
  );
}

type StepProps = { title: string; n?: number; children?: ReactNode };

function Step({ title, n = 0, children }: StepProps) {
  return (
    <li
      style={{ "--i": Math.min(n, 3) } as CSSProperties}
      className="bg-card ml-[calc(var(--i)*18px)] flex-1 rounded-xl border px-4 py-3.5 sm:ml-0 sm:translate-y-[calc(var(--i)*-10px)]"
    >
      <p className="font-mono text-[11.5px] leading-normal tracking-[0.12em] text-(--stop-ink)">
        第 {n + 1} 階
      </p>
      <p className="font-heading mt-1 mb-1.5 text-base leading-snug">{title}</p>
      <div className="text-muted-foreground text-[12.5px] leading-relaxed [&_p]:mb-0 [&_p]:text-[12.5px] [&_p]:leading-relaxed">
        {children}
      </div>
    </li>
  );
}

/* ── Markdown 元素 ── */

function H2({ children, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      {...props}
      id={headingId(textOf(children))}
      className="mt-10 mb-3.5 scroll-mt-20 text-[21px] font-semibold text-balance sm:text-[25px]"
    >
      {children}
    </h2>
  );
}

function A({ href = "", children, ...props }: ComponentProps<"a">) {
  const cls =
    "text-primary decoration-primary/40 hover:decoration-primary underline underline-offset-4";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls} {...props}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cls} {...props}>
      {children}
      <span className="sr-only">（於新視窗開啟）</span>
    </a>
  );
}

const body = "text-[16px] leading-[1.85] text-pretty sm:text-[16.5px]";

export const guideMdxComponents: MDXComponents = {
  h2: H2,
  h3: (p) => <h3 {...p} className="mt-8 mb-2.5 text-lg font-semibold" />,
  p: (p) => <p {...p} className={cn(body, "mb-4")} />,
  ul: (p) => <ul {...p} className="mb-4 list-disc space-y-1.5 pl-6 marker:text-(--stop)" />,
  ol: (p) => (
    <ol {...p} className="mb-4 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground" />
  ),
  li: (p) => <li {...p} className={body} />,
  a: A,
  strong: (p) => (
    <strong
      {...p}
      className="font-medium shadow-[inset_0_-0.45em_0_color-mix(in_oklab,var(--stop)_22%,transparent)]"
    />
  ),
  img: ({ alt = "", ...p }) => (
    // eslint-disable-next-line @next/next/no-img-element -- MDX 圖片沒有固定尺寸
    <img
      {...p}
      alt={alt}
      loading="lazy"
      className="bg-muted my-5 h-auto w-full rounded-xl border"
    />
  ),
  table: (p) => (
    <div className="bg-card my-5 overflow-hidden rounded-xl border">
      <Table {...p} />
    </div>
  ),
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: (p) => <TableHead {...p} className="bg-muted/60 font-heading" />,
  td: (p) => <TableCell {...p} className="whitespace-normal" />,
  Item,
  Map: MapRef,
  Monster,
  Skill,
  Mission,
  Tip,
  Warning,
  Verify,
  Checklist,
  Check,
  Steps,
  Step,
  BoxContents,
  MissionCard,
  DungeonStep,
  StepDone,
  StepMap,
  RouteTabs,
  RouteTab,
  StepTargets,
  NineRoomGrid,
};
