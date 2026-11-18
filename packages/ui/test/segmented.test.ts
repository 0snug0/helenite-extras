import { describe, expect, it, vi } from "vitest";
import { segmented } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const opts = [
  { value: "a", text: "A" },
  { value: "b", text: "B" },
];

describe("segmented", () => {
  it("renders .hel-segmented > button.hel-segment per option, aria-pressed on the value, optional .hel-segmented-label text", () => {
    const s = segmented(host(), { label: "Mode", options: opts, value: "b", onChange: () => {} });
    expect(s.el.classList.contains("hel-segmented")).toBe(true);
    const segs = s.el.querySelectorAll(":scope > button.hel-segment");
    expect(segs.length).toBe(2);
    expect(segs[0].getAttribute("aria-pressed")).toBe("false");
    expect(segs[1].getAttribute("aria-pressed")).toBe("true");
    expect(s.el.querySelector(".hel-segmented-label")?.textContent).toBe("Mode");
    expect(segmented(host(), { options: opts, value: "a", onChange: () => {} }).el.querySelector(".hel-segmented-label")).toBeNull();
  });

  it("clicking another segment calls onChange once with its value; clicking the active one does not", () => {
    const onChange = vi.fn();
    const s = segmented(host(), { options: opts, value: "a", onChange });
    const [a, b] = Array.from(s.el.querySelectorAll<HTMLButtonElement>("button"));
    a.click();
    expect(onChange).not.toHaveBeenCalled();
    b.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");
    expect(b.getAttribute("aria-pressed")).toBe("true");
    s.setValue("a");
    expect(a.getAttribute("aria-pressed")).toBe("true");
  });
});
