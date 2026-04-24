import type { TriangleSolution } from "@/lib/solvers/god-quest";

type CellSpec = {
  cx: number;
  cy: number;
  value: number;
  highlight?: boolean;
};

export function MagicTriangleSvg({ solution }: { solution: TriangleSolution }) {
  const cells: CellSpec[] = [
    { cx: 210, cy: 60, value: solution.T },
    { cx: 160, cy: 150, value: solution.u1, highlight: true },
    { cx: 260, cy: 150, value: solution.p1 },
    { cx: 110, cy: 240, value: solution.u2 },
    { cx: 310, cy: 240, value: solution.p2 },
    { cx: 60, cy: 360, value: solution.BL },
    { cx: 160, cy: 360, value: solution.m1 },
    { cx: 260, cy: 360, value: solution.m2 },
    { cx: 360, cy: 360, value: solution.BR },
  ];

  return (
    <svg
      viewBox="0 0 420 420"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label="魔三角形解答"
    >
      <polygon
        points="210,60 60,360 360,360"
        className="stroke-border/70 fill-none"
        strokeWidth={2}
      />
      {cells.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.cx}
            cy={c.cy}
            r={26}
            className={
              c.highlight
                ? "fill-rose-500/15 stroke-rose-500"
                : "fill-card stroke-border"
            }
            strokeWidth={2}
          />
          <text
            x={c.cx}
            y={c.cy + 8}
            textAnchor="middle"
            className={
              c.highlight
                ? "fill-rose-600 dark:fill-rose-300 font-semibold"
                : "fill-foreground font-semibold"
            }
            fontSize={22}
          >
            {c.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
