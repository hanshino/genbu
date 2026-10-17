"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOG_LIMIT } from "@/lib/idle/view";
import type { LogEntry } from "./runtime";

export function LogTab({ entries }: { entries: LogEntry[] }) {
  return (
    <Card>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">還沒有紀錄，角色開打後會顯示在這裡。</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">時間</TableHead>
                  <TableHead>事件</TableHead>
                  <TableHead className="text-right">獲得</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground align-top text-xs tabular-nums">{e.time}</TableCell>
                    <TableCell className="whitespace-normal">{e.text}</TableCell>
                    <TableCell className="text-primary text-right tabular-nums">
                      {e.gain.split("　").map((part) => (
                        <span key={part} className="block whitespace-nowrap">
                          {part}
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-muted-foreground mt-2 text-xs">只保留最近 {LOG_LIMIT} 筆；一般命中不記。</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
