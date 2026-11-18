"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SERVERS } from "@/lib/market-price";
import { switchServerParams } from "@/lib/market-listings";
import type { ServerId } from "@/lib/queries/market-prices";

/** 和「玩家回報市價」同一種伺服器切換；只列有掃描資料的伺服器，只有一台時呼叫端不要渲染它。 */
function ServerToggle({
  servers,
  value,
  onChange,
}: {
  servers: readonly ServerId[];
  value: ServerId;
  onChange: (server: ServerId) => void;
}) {
  return (
    <ToggleGroup
      aria-label="伺服器"
      value={[value]}
      onValueChange={(next) => {
        if (next[0]) onChange(next[0] as ServerId);
      }}
      className="max-sm:w-full"
    >
      {SERVERS.filter((s) => servers.includes(s.id)).map((s) => (
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
  );
}

/** 道具頁：各伺服器的內容在伺服器端先渲染好，這裡只負責切換顯示哪一份。 */
export function ServerPanels({
  servers,
  panels,
  initial,
}: {
  servers: ServerId[];
  panels: Partial<Record<ServerId, ReactNode>>;
  /** 預設顯示哪個伺服器；沒給就用第一個 */
  initial?: ServerId;
}) {
  const [server, setServer] = useState<ServerId>(initial ?? servers[0]);
  return (
    <div className="space-y-3">
      <ServerToggle servers={servers} value={server} onChange={setServer} />
      {panels[server]}
    </div>
  );
}

/** /market：伺服器放在網址上，切換時保留 view 與搜尋字，丟掉類型、頁碼與展開的攤位。 */
export function ServerQueryToggle({ servers, value }: { servers: ServerId[]; value: ServerId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <ServerToggle
      servers={servers}
      value={value}
      onChange={(server) => {
        const params = switchServerParams(searchParams.toString(), server);
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
