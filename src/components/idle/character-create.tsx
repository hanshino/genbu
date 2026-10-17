"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from "react";
import { NAME_MAX_BYTES } from "@/configs/idle";
import {
  START_POINTS,
  nameBytes,
  nameProblem,
  normalizeName,
  parseBirthdayInput,
  startAttributes,
} from "@/lib/idle/creation";
import {
  createLayout,
  type Box,
  type ButtonState,
  type ImageButton,
  type PickerKey,
} from "@/lib/idle/create-layout";
import type { IdleGender } from "@/lib/idle/types";
import type { IdleCreateAssets } from "@/lib/queries/idle";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/lib/types/stat-sim";
import { postJson, type IdleView } from "./api";
import { CreateDoll, availableActions } from "./create-doll";
import styles from "./character-create.module.css";
import { TrialBadge, TrialNote } from "./trial-label";
import { scaleFor } from "./window-scale";

/** 輸入框內部的字至少要 16 px（iOS 聚焦時小於 16 px 會自動放大頁面），再整個縮回遊戲大小。 */
const INPUT_FONT = 11;
const MIN_INPUT_PX = 16;

const ATTRIBUTE_INFO: Record<AttributeKey, { name: string; effect: string }> = {
  str: { name: "外功", effect: "提升物攻與武器傷害。" },
  pow: { name: "內力", effect: "提升內勁與真氣。" },
  vit: { name: "根骨", effect: "提升體力與防禦。" },
  agi: { name: "身法", effect: "提升閃躲與攻擊速度。" },
  dex: { name: "技巧", effect: "提升命中與重擊，命中太低會打不到怪。" },
  wis: { name: "玄學", effect: "提供特殊加成。" },
};

const DEFAULT_DESCRIPTION = `新角色有 ${START_POINTS} 點屬性點可以分配，沒用完的會留到進遊戲後再分配。`;

const GENDER_LABEL: Record<IdleGender, string> = { m: "男", f: "女" };

/** 還沒開放的選項：顯示固定的值。 */
const FIXED_VALUE: Record<Exclude<PickerKey, "gender">, string> = {
  hair: "預設",
  hairColor: "預設",
  portrait: "預設",
  story: "預設",
  birthplace: "流星雷島˙南",
};

/** 看不見的點擊範圍（底圖 px）。原作的鈕只有 12 px，縮到手機上不到 11 px；相鄰的加減鈕只能朝外加大。 */
interface Hit {
  t: number;
  r: number;
  b: number;
  l: number;
}
const HIT_PICKER_LEFT: Hit = { t: 6, r: 5, b: 6, l: 10 };
const HIT_PICKER_RIGHT: Hit = { t: 6, r: 10, b: 6, l: 5 };
const HIT_PLUS: Hit = { t: 5, r: 2, b: 5, l: 10 };
const HIT_MINUS: Hit = { t: 5, r: 10, b: 5, l: 2 };
const HIT_DOLL: Hit = { t: 6, r: 6, b: 6, l: 6 };

/** 紙娃娃的畫框（藍色框內側，底圖座標）。 */
const DOLL_CLIP: Box = { x: 88, y: 42, w: 117, h: 117 };

const u = (n: number) => `calc(var(--u) * ${n})`;
const place = (b: Box): CSSProperties => ({ left: u(b.x), top: u(b.y), width: u(b.w), height: u(b.h) });

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function GameButton({
  button,
  hit,
  label,
  title,
  className,
  disabled,
  type = "button",
  describedBy,
  onClick,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onFocus,
  onBlur,
}: {
  button: ImageButton;
  hit: Hit;
  label: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  describedBy?: string;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const style: Record<string, string | number> = {
    ...place(button.box),
    "--ht": hit.t,
    "--hr": hit.r,
    "--hb": hit.b,
    "--hl": hit.l,
  };
  for (const [state, url] of Object.entries(button.icons) as [ButtonState, string][]) {
    style[`--${state}`] = `url("${url}")`;
  }
  return (
    <button
      type={type}
      className={`${styles.btn} ${className ?? ""}`}
      style={style as CSSProperties}
      aria-label={label}
      aria-describedby={describedBy}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

export function CharacterCreate({
  assets,
  onCreated,
  onExists,
}: {
  assets: IdleCreateAssets;
  /** 建立成功：交給外層載入遊戲。 */
  onCreated: (view: IdleView) => void;
  /** 伺服器說已經有存檔了（例如在別的分頁建立過）。 */
  onExists: () => void;
}) {
  const router = useRouter();
  const layout = useMemo(() => createLayout(assets.window), [assets]);
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedMotionNow, () => false);
  const descId = useId();
  const messageId = useId();

  const holder = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const monthInput = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);

  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [gender, setGender] = useState<IdleGender>("m");
  const [attributes, setAttributes] = useState(startAttributes);
  const [nameTouched, setNameTouched] = useState(false);
  const [birthdayTouched, setBirthdayTouched] = useState(false);
  const [hover, setHover] = useState<AttributeKey | null>(null);
  const [focused, setFocused] = useState<AttributeKey | null>(null);
  const [picked, setPicked] = useState<AttributeKey | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 倍率跟著可用寬度走。
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(scaleFor(w, layout.width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.width]);

  // 先把 hover / 按下的圖與兩種性別的動作圖載進快取，切換時才不會閃一下。
  useEffect(() => {
    const urls = new Set<string>();
    const buttons = [
      layout.finish,
      layout.back,
      layout.dollPrev,
      layout.dollNext,
      ...layout.pickers.flatMap((p) => [p.left, p.right]),
      ...layout.attributes.flatMap((a) => [a.plus, a.minus]),
    ];
    for (const b of buttons) for (const url of Object.values(b.icons)) urls.add(url);
    for (const set of Object.values(assets.strips)) for (const strip of Object.values(set)) urls.add(strip.url);
    for (const url of urls) new Image().src = url;
  }, [layout, assets]);

  const strips = assets.strips[gender];
  const actions = useMemo(() => availableActions(strips), [strips]);
  const action = actions[actionIndex % Math.max(1, actions.length)];

  const trimmed = normalizeName(name);
  const nameError = nameProblem(trimmed);
  const bytes = nameBytes(trimmed);
  const birthday = parseBirthdayInput(month, day);
  const spent = ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key] - 1, 0);
  const points = START_POINTS - spent;

  // 名字有打字就即時檢查；空的名字等離開輸入框才提醒。
  const showNameError = nameError !== null && (name !== "" || nameTouched);
  const showBirthdayError = !birthday.ok && birthdayTouched;
  const message = showNameError
    ? nameError
    : showBirthdayError
      ? birthday.error
      : serverError;

  const presetLabel = `入門弟子・刀（${GENDER_LABEL[gender]}）`;
  const shown = hover ?? focused ?? picked;

  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    setServerError(null);
    set(value);
  };

  const changeAttribute = (key: AttributeKey, delta: 1 | -1) => {
    setServerError(null);
    setAttributes((current) => ({ ...current, [key]: current[key] + delta }));
  };

  const touchPick = (key: AttributeKey) => (e: PointerEvent) => {
    // 觸控沒有 hover：點過的屬性就留著說明。
    if (e.pointerType !== "mouse") setPicked(key);
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (nameError) {
      setNameTouched(true);
      nameInput.current?.focus();
      return;
    }
    if (!birthday.ok) {
      setBirthdayTouched(true);
      monthInput.current?.focus();
      return;
    }
    setBusy(true);
    setServerError(null);
    const res = await postJson<IdleView>("/api/idle/start", {
      name: trimmed,
      gender,
      attributes,
      ...(birthday.birthday ? { birthday: birthday.birthday } : {}),
    });
    if (res.ok) {
      onCreated(res.body);
      return;
    }
    if (res.status === 409) {
      onExists();
      return;
    }
    setServerError(res.error);
    setBusy(false);
  };

  const description = shown ? (
    <>
      <b>
        {ATTRIBUTE_INFO[shown].name}：{attributes[shown]}
      </b>
      <span>{ATTRIBUTE_INFO[shown].effect}</span>
    </>
  ) : (
    <span>{DEFAULT_DESCRIPTION}</span>
  );

  const fontScale = Math.max(1, MIN_INPUT_PX / (INPUT_FONT * scale));
  const winStyle = { width: layout.width * scale, "--s": scale, "--f": fontScale } as CSSProperties;

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-black tracking-wide sm:text-3xl">建立角色</h1>
          <TrialBadge />
        </div>
        <p className="text-muted-foreground text-sm">摸魚練功房的新角色都從入門弟子出發。</p>
        <TrialNote />
      </header>

      <div ref={holder} className="w-full">
        <form className={styles.win} style={winStyle} onSubmit={submit} noValidate aria-label="創造角色">
          {/* eslint-disable-next-line @next/next/no-img-element -- 遊戲原圖 hotlink，需要 pixelated 與絕對定位 */}
          <img
            src={layout.backgroundUrl}
            alt=""
            width={layout.width}
            height={layout.height}
            className={styles.bg}
            draggable={false}
          />
          <div className={styles.layer}>
            <span className={`${styles.f} ${styles.title}`} style={place(layout.title.box)} aria-hidden>
              {layout.title.text}
            </span>
            {layout.labels.map((l) => (
              <span
                key={l.id}
                aria-hidden
                className={`${styles.f} ${styles.label} ${l.id === 125 ? styles.tab : ""}`}
                style={place(l.box)}
              >
                {l.text}
              </span>
            ))}

            <CreateDoll
              strips={strips}
              action={action?.action ?? "wait"}
              anchor={layout.dollAnchor}
              clip={DOLL_CLIP}
              reducedMotion={reducedMotion}
            />
            <span
              role="img"
              aria-label={`${presetLabel}，動作：${action?.label ?? "待機"}`}
              className={styles.dollClip}
              style={place(DOLL_CLIP)}
            />
            <GameButton
              button={layout.dollPrev}
              hit={HIT_DOLL}
              label="紙娃娃：上一個動作"
              onClick={() => setActionIndex((i) => (i + actions.length - 1) % actions.length)}
            />
            <GameButton
              button={layout.dollNext}
              hit={HIT_DOLL}
              label="紙娃娃：下一個動作"
              onClick={() => setActionIndex((i) => (i + 1) % actions.length)}
            />

            {/* 名字與生日 */}
            <div className={styles.field} style={place(layout.name)}>
              <input
                ref={nameInput}
                className={styles.input}
                value={name}
                onChange={(e) => edit(setName)(e.target.value)}
                onBlur={() => setNameTouched(true)}
                maxLength={40}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                aria-label="名字"
                aria-invalid={showNameError}
                aria-describedby={messageId}
                aria-required
              />
            </div>
            <div className={styles.field} style={place(layout.month)}>
              <input
                ref={monthInput}
                className={styles.input}
                value={month}
                onChange={(e) => edit(setMonth)(e.target.value)}
                onBlur={() => setBirthdayTouched(true)}
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
                aria-label="生日：月（選填）"
                aria-invalid={showBirthdayError}
                aria-describedby={messageId}
              />
            </div>
            <div className={styles.field} style={place(layout.day)}>
              <input
                className={styles.input}
                value={day}
                onChange={(e) => edit(setDay)(e.target.value)}
                onBlur={() => setBirthdayTouched(true)}
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
                aria-label="生日：日（選填）"
                aria-invalid={showBirthdayError}
                aria-describedby={messageId}
              />
            </div>

            {/* 選擇列：只有性別能換，其餘先固定 */}
            {layout.pickers.map((row) => {
              const isGender = row.key === "gender";
              const value = isGender ? GENDER_LABEL[gender] : FIXED_VALUE[row.key as Exclude<PickerKey, "gender">];
              const title = row.label.replace("：", "");
              const toggle = () => setGender((g) => (g === "m" ? "f" : "m"));
              return (
                <div key={row.key}>
                  <output
                    className={`${styles.f} ${styles.value} ${row.key === "birthplace" ? styles.tight : ""}`}
                    style={place(row.value)}
                    aria-label={`${title}：${value}`}
                    title={`${title}：${value}`}
                  >
                    {value}
                  </output>
                  <GameButton
                    button={row.left}
                    hit={HIT_PICKER_LEFT}
                    className={isGender ? "" : styles.inert}
                    disabled={!isGender}
                    label={isGender ? `${title}：上一個選項` : `${title}：尚未開放`}
                    title={isGender ? undefined : `${title}：尚未開放`}
                    onClick={isGender ? toggle : undefined}
                  />
                  <GameButton
                    button={row.right}
                    hit={HIT_PICKER_RIGHT}
                    className={isGender ? "" : styles.inert}
                    disabled={!isGender}
                    label={isGender ? `${title}：下一個選項` : `${title}：尚未開放`}
                    title={isGender ? undefined : `${title}：尚未開放`}
                    onClick={isGender ? toggle : undefined}
                  />
                </div>
              );
            })}

            {/* 屬性 */}
            {layout.attributes.map((row) => {
              const info = ATTRIBUTE_INFO[row.key];
              const handlers = {
                onPointerEnter: () => setHover(row.key),
                onPointerLeave: () => setHover(null),
                onPointerDown: touchPick(row.key),
                onFocus: () => setFocused(row.key),
                onBlur: () => setFocused(null),
              };
              return (
                <div key={row.key}>
                  <output
                    className={`${styles.f} ${styles.value} ${styles.mono}`}
                    style={place(row.value)}
                    aria-label={`${info.name} ${attributes[row.key]}`}
                    onPointerEnter={handlers.onPointerEnter}
                    onPointerLeave={handlers.onPointerLeave}
                  >
                    {attributes[row.key]}
                  </output>
                  <GameButton
                    button={row.plus}
                    hit={HIT_PLUS}
                    className={styles.dim}
                    disabled={points <= 0 || busy}
                    label={`${info.name}加 1 點`}
                    title={points <= 0 ? "屬性點用完了" : `${info.name} +1`}
                    describedBy={descId}
                    onClick={() => changeAttribute(row.key, 1)}
                    {...handlers}
                  />
                  <GameButton
                    button={row.minus}
                    hit={HIT_MINUS}
                    className={styles.dim}
                    disabled={attributes[row.key] <= 1 || busy}
                    label={`${info.name}減 1 點`}
                    title={attributes[row.key] <= 1 ? `${info.name}最低是 1` : `${info.name} −1`}
                    describedBy={descId}
                    onClick={() => changeAttribute(row.key, -1)}
                    {...handlers}
                  />
                </div>
              );
            })}

            <output
              className={`${styles.f} ${styles.value} ${styles.mono}`}
              style={place(layout.points)}
              aria-label={`剩餘屬性點 ${points}`}
            >
              {points}
            </output>
            <div id={descId} className={`${styles.f} ${styles.desc}`} style={place(layout.description)}>
              {description}
            </div>

            <GameButton
              button={layout.finish}
              hit={{ t: 0, r: 0, b: 0, l: 0 }}
              type="submit"
              label={busy ? "建立中" : "設定完成"}
              disabled={nameError !== null || busy}
            />
            <GameButton
              button={layout.back}
              hit={{ t: 0, r: 0, b: 0, l: 0 }}
              label="回上一頁"
              disabled={busy}
              onClick={goBack}
            />
          </div>
        </form>
      </div>

      <div
        id={messageId}
        className="mx-auto min-h-10 text-center text-sm"
        style={{ maxWidth: layout.width * scale }}
      >
        {message ? (
          <p role="alert" className="text-destructive">
            {message}
          </p>
        ) : (
          <p className="text-muted-foreground">
            名字最長 {NAME_MAX_BYTES} 位元組（英數字算 1、中文字算 2），目前 {bytes}。生日可以不填。
          </p>
        )}
      </div>
    </div>
  );
}
