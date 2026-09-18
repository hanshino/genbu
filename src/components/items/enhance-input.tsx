"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { MAX_ENHANCEMENTS, formatEnhance, suggestEnhance } from "@/lib/enhance";

/**
 * 強化欄：打「內勁8」按 Enter 就變一個標籤。
 *
 * 屬性名和數值一起打，是因為只給屬性名組不出有效的一段強化——沒有數值的「內勁」不知道值多少。
 * 所以還沒打數值時不給選項，只在下方提示比對到哪些屬性名。
 */
export function EnhanceInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const anchor = useComboboxAnchor();
  const full = value.length >= MAX_ENHANCEMENTS;

  const { codes, labels } = useMemo(() => suggestEnhance(query, value), [query, value]);

  const hint = full
    ? `最多 ${MAX_ENHANCEMENTS} 項，要再填請先移除一個。`
    : labels.length > 0
      ? `${labels.join("、")} — 後面接數值，例如「${labels[0]}8」`
      : query.trim().length > 0
        ? "沒有這個屬性。"
        : "打屬性名加數值，例如「內勁8」。";

  return (
    <Combobox
      items={full ? [] : codes}
      filter={null}
      // 打完「內勁8」直接按 Enter 就成立；沒這個就得先按方向鍵去點亮選項。
      autoHighlight
      multiple
      value={value}
      onValueChange={(next) => {
        onChange(next as string[]);
        setQuery("");
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(code: string) => formatEnhance(code)}
    >
      <ComboboxChips ref={anchor} className="min-h-9">
        {/* Chip 沒有 value prop，移除是靠它在 Chips 裡的順序；渲染順序照 value 陣列就對得上。 */}
        {value.map((code) => (
          <ComboboxChip key={code}>{formatEnhance(code)}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          id={id}
          aria-label="強化屬性"
          placeholder={value.length > 0 ? "" : "內勁8"}
        />
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{hint}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(code: string) => (
              <ComboboxItem key={code} value={code}>
                {formatEnhance(code)}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
