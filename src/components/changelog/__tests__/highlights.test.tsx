import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Highlights } from "../highlights";

describe("Highlights", () => {
  it("有項目：顯示標題與每條重點", () => {
    render(<Highlights items={["端午活動上線", "日月迷宮拆分"]} />);
    expect(screen.getByText("本版重點")).toBeInTheDocument();
    expect(screen.getByText("端午活動上線")).toBeInTheDocument();
    expect(screen.getByText("日月迷宮拆分")).toBeInTheDocument();
  });

  it("空陣列：不渲染", () => {
    const { container } = render(<Highlights items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
