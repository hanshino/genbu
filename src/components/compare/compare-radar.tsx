"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { Item } from "@/lib/types/item";
import { itemAttributeNames } from "@/lib/constants/i18n";

const RADAR_KEYS = [
  "str",
  "pow",
  "wis",
  "agi",
  "atk",
  "matk",
  "def",
  "mdef",
] as const;

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Props {
  items: Item[];
  maxValues: Record<string, number>;
}

export function CompareRadar({ items, maxValues }: Props) {
  if (items.length === 0) return null;

  const data = RADAR_KEYS.map((key) => {
    const row: Record<string, number | string> = {
      label: itemAttributeNames[key] ?? key,
    };
    const max = Math.max(1, maxValues[key] ?? 0);
    for (const it of items) {
      const raw = (it as unknown as Record<string, number | null>)[key];
      const n = typeof raw === "number" ? raw : 0;
      row[String(it.id)] = Math.round((n / max) * 100);
    }
    return row;
  });

  return (
    <div
      className="h-[280px] w-full"
      role="img"
      aria-label="各裝備主要屬性雷達圖，精確數值見下方屬性矩陣"
    >
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="78%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickFormatter={(v: number) => `${v}`}
          />
          {items.map((it, i) => (
            <Radar
              key={it.id}
              name={it.name}
              dataKey={String(it.id)}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              fillOpacity={0.2}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "calc(var(--radius) * 0.8)",
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value ?? 0);
              return [`${n}%`, "相對強度"];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
