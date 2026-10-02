"use client";

import { useMemo, useState } from "react";
import {
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCharacters } from "@/lib/hooks/use-characters";
import { bareFromEquipped, computePanel } from "@/lib/stat-sim";
import type {
  AttributeKey,
  CharacterV1,
  EquipSlot,
  EquippedItem,
  GameData,
  PanelResult,
  UiWindowLayout,
} from "@/lib/types/stat-sim";
import { AttributeWindow } from "./attribute-window";
import { BasicTab } from "./basic-tab";
import { CharacterBar } from "./character-bar";
import { EquipmentWindow } from "./equipment-window";
import { ItemPicker } from "./item-picker";
import { STAT_LABELS, type ViewKey } from "./labels";
import { ComingSoonCards, CostBandCard, ExtraCard, IssuesCard, SourceCard } from "./panel-cards";
import { PassivesTab } from "./passives-tab";
import { attributeFields, equipmentFields } from "./window-layout";

interface Props {
  data: GameData;
  windows: { attribute: UiWindowLayout; equipment: UiWindowLayout };
}

type Computed = { panel: PanelResult; error: null } | { panel: null; error: string };

export function StatSimClient({ data, windows }: Props) {
  const store = useCharacters();
  const { active } = store;
  const [tab, setTab] = useState("basic");
  const [selected, setSelected] = useState<ViewKey>("atk");
  const [gearMode, setGearMode] = useState(true);
  const [picking, setPicking] = useState<EquipSlot | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const attrFields = useMemo(() => attributeFields(windows.attribute), [windows.attribute]);
  const eqFields = useMemo(() => equipmentFields(windows.equipment), [windows.equipment]);

  const computed = useMemo<Computed | null>(() => {
    if (!active) return null;
    try {
      return { panel: computePanel(active, data), error: null };
    } catch (e) {
      // 等級、六圍或門派不合法時引擎丟 RangeError；顯示錯誤，不讓整頁掛掉
      return { panel: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [active, data]);
  const panel = computed?.panel ?? null;

  const weaponTypes = useMemo(
    () =>
      (["right", "left"] as const).flatMap((slot) => {
        const worn = active?.equipment[slot];
        const type = worn ? data.itemsById[worn.itemId]?.typeName : null;
        return type ? [type] : [];
      }),
    [active, data.itemsById],
  );

  if (!store.loaded) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">正在讀取這台裝置上的角色…</p>
    );
  }

  const update = (fn: (c: CharacterV1) => CharacterV1) => {
    if (active) store.update(active.id, fn);
  };

  const addPoint = (key: AttributeKey) => {
    if (!panel || panel.points.remaining < panel.points.nextCost[key]) return;
    setEditError(null);
    update((c) => ({ ...c, attributes: { ...c.attributes, [key]: c.attributes[key] + 1 } }));
  };

  const editAttr = (key: AttributeKey, typed: number) => {
    if (!active) return;
    const label = STAT_LABELS[key];
    // 含裝值 − 裝備（與被動、手動）給的六圍 = 不含裝值
    const bonus = (panel?.attributes[key].value ?? active.attributes[key]) - active.attributes[key];
    const bare = gearMode ? bareFromEquipped(typed, bonus) : typed;
    if (!Number.isSafeInteger(bare) || bare < 1) {
      setEditError(
        gearMode
          ? `含裝${label} ${typed} 扣掉裝備的 ${bonus} 後是 ${bare}，不含裝至少要 1，請檢查裝備有沒有填對。`
          : `不含裝${label}至少要 1。`,
      );
      return;
    }
    setEditError(null);
    update((c) => ({ ...c, attributes: { ...c.attributes, [key]: bare } }));
  };

  const applyEquip = (slot: EquipSlot, value: EquippedItem | null) => {
    update((c) => ({ ...c, equipment: { ...c.equipment, [slot]: value } }));
    setPicking(null);
  };

  if (!active) {
    return (
      <>
        <CharacterBar store={store} />
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            還沒有角色。新增一隻，開始填門派、等級與裝備。
          </p>
          <Button className="mt-4" onClick={() => store.create()}>
            <UserPlusIcon />
            新增角色
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <CharacterBar store={store} />
      <div className="grid items-start gap-6 min-[1180px]:grid-cols-[minmax(424px,1fr)_minmax(0,800px)]">
        <div className="order-2 min-w-0 min-[1180px]:order-1">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-4">
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="basic">
                <UserIcon />
                基本
              </TabsTrigger>
              <TabsTrigger value="passive">
                <SparklesIcon />
                被動與加成
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basic">
              <BasicTab character={active} update={update} />
            </TabsContent>
            <TabsContent value="passive">
              <PassivesTab
                character={active}
                data={data}
                weaponTypes={weaponTypes}
                update={update}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="order-1 mx-auto w-full max-w-[800px] min-w-0 space-y-4 min-[1180px]:order-2">
          <AttributeWindow
            layout={windows.attribute}
            fields={attrFields}
            character={active}
            panel={panel}
            gearMode={gearMode}
            selected={selected}
            onSelect={setSelected}
            onAdd={addPoint}
            onEdit={editAttr}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">六圍輸入</span>
            <ToggleGroup
              aria-label="六圍數值模式"
              value={[gearMode ? "gear" : "bare"]}
              onValueChange={(v) => v[0] && setGearMode(v[0] === "gear")}
            >
              <ToggleGroupItem value="gear" size="sm">
                含裝
              </ToggleGroupItem>
              <ToggleGroupItem value="bare" size="sm">
                不含裝
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditError(null);
                update((c) => ({
                  ...c,
                  attributes: { str: 1, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
                }));
              }}
            >
              <RotateCcwIcon />
              重設配點
            </Button>
            <span className="text-xs text-muted-foreground max-sm:basis-full">
              點六圍數字可直接輸入，按「+」加 1 點。
            </span>
          </div>
          {editError && (
            <p role="alert" className="text-xs text-destructive">
              {editError}
            </p>
          )}

          {computed?.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              面板算不出來：{computed.error}
            </div>
          ) : (
            panel && <SourceCard panel={panel} statKey={selected} />
          )}

          <div className="grid items-start gap-4 sm:grid-cols-[50%_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[320px] sm:max-w-none">
              <EquipmentWindow
                layout={windows.equipment}
                fields={eqFields}
                character={active}
                items={data.itemsById}
                picking={picking}
                onPick={setPicking}
              />
            </div>
            {panel && (
              <div className="min-w-0 space-y-3">
                <ExtraCard panel={panel} onSelect={setSelected} />
                {gearMode && <CostBandCard character={active} panel={panel} />}
                <IssuesCard panel={panel} />
              </div>
            )}
          </div>

          <ComingSoonCards />
        </div>
      </div>

      <ItemPicker
        slot={picking}
        data={data}
        equipment={active.equipment}
        onSlotChange={setPicking}
        onClose={() => setPicking(null)}
        onApply={applyEquip}
      />
    </>
  );
}
