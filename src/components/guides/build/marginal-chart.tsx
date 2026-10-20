"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CalcInput } from "@/lib/build-calc";
import { CURVE_START, curveData, curveEnd } from "./curve";

// 外功 = 朱砂、玄學 = 靛青；配色過 dataviz validate_palette（淺／深色底都通過）。
const STR_COLOR = "var(--chart-1)";
const WIS_COLOR = "var(--chart-3)";

/**
 * 邊際效應：橫軸是自己點的點數，縱軸是「再花 1 個屬性點，一發多幾點傷害」。
 * 外功線只動外功、玄學線只動玄學；圓點是輸入的目前位置。
 */
export function MarginalChart({
  input,
  marks = "you",
}: {
  input: CalcInput;
  /** 圓點標籤：計算器寫「你的外功」，文章裡的固定情境寫「外功 57」。 */
  marks?: "you" | "values";
}) {
  const end = curveEnd(input);
  const data = curveData(input);
  const at = (v: number) => data.find((p) => p.value === v);
  const strDot = at(input.strBase);
  const wisDot = at(input.wisBase);

  return (
    <div
      className="h-[260px] w-full sm:h-[300px]"
      role="img"
      aria-label="外功與玄學每花 1 個屬性點增加的傷害曲線，精確數值見數據表"
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
          <XAxis
            dataKey="value"
            type="number"
            domain={[CURVE_START, end]}
            ticks={Array.from({ length: Math.floor(end / 20) }, (_, i) => (i + 1) * 20)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            stroke="var(--border)"
            label={{
              value: "自己點的點數",
              position: "insideBottomRight",
              offset: -2,
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
            height={36}
          />
          <YAxis
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            stroke="var(--border)"
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "calc(var(--radius) * 0.8)",
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
            itemStyle={{ color: "var(--foreground)" }}
            labelFormatter={(v) => `點到 ${v} 點時`}
            formatter={(value, name) => [`每屬性點 +${value} 傷害`, name]}
          />
          <Legend
            iconType="plainline"
            iconSize={14}
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
          />
          <Line
            name="外功"
            dataKey="str"
            stroke={STR_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
          <Line
            name="玄學"
            dataKey="wis"
            stroke={WIS_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
          {strDot && (
            <ReferenceDot
              x={strDot.value}
              y={strDot.str}
              r={5}
              fill={STR_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
              label={{ value: marks === "you" ? "你的外功" : `外功 ${input.strBase}`, position: "top", fill: "var(--foreground)", fontSize: 11 }}
            />
          )}
          {wisDot && (
            <ReferenceDot
              x={wisDot.value}
              y={wisDot.wis}
              r={5}
              fill={WIS_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
              label={{ value: marks === "you" ? "你的玄學" : `玄學 ${input.wisBase}`, position: "top", fill: "var(--foreground)", fontSize: 11 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
