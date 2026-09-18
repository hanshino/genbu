import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnhanceInput } from "@/components/items/enhance-input";

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <EnhanceInput value={value} onChange={setValue} />
      <output data-testid="value">{value.join(",")}</output>
    </>
  );
}

function field() {
  return screen.getByRole("combobox", { name: "強化屬性" });
}

function value() {
  return screen.getByTestId("value").textContent;
}

describe("EnhanceInput", () => {
  it("打屬性名加數值就能選成標籤，存的是屬性 key 不是中文", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "內勁8");
    await user.click(await screen.findByRole("option", { name: "內勁 +8" }));

    expect(value()).toBe("matk:8");
    expect(screen.getByText("內勁 +8")).toBeInTheDocument();
  });

  it("按 Enter 就成標籤，不用把手移到清單上", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "閃躲7{Enter}");

    expect(value()).toBe("dodge:7");
  });

  it("只打屬性名時沒有選項，改提示還要補數值", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "內");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(await screen.findByText(/內勁、內力/)).toBeInTheDocument();
  });

  it("認不得的屬性給不出選項，也不會硬存成標籤", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "香蕉9{Enter}");

    expect(value()).toBe("");
  });

  it("選過的屬性不再出現在建議裡，同一個屬性填不了兩次", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["matk:8"]} />);

    await user.type(field(), "內6");

    const options = screen.queryAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["內力 +6"]);
  });

  it("移除鈕拿掉對應的那一個標籤", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["matk:8", "hit:7"]} />);

    const removes = screen.getAllByRole("button");
    await user.click(removes[0]);

    expect(value()).toBe("hit:7");
  });
});
