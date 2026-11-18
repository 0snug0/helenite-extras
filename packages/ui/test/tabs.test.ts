import { describe, expect, it, vi } from "vitest";
import { tabs } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const tab = (el: HTMLElement, id: string) => el.querySelector<HTMLButtonElement>(`[data-tab=${id}]`)!;

describe("tabs", () => {
  const spec = [{ id: "a", text: "A" }, { id: "b", text: "B", badge: 3 }, { id: "c", text: "C" }];

  it("selects by click and with arrow keys (roving tabindex, wrapping), firing onSelect on a change only", () => {
    const onSelect = vi.fn();
    const t = tabs(host(), { tabs: spec, value: "a", onSelect });
    expect(t.el.getAttribute("role")).toBe("tablist");
    expect(tab(t.el, "a").classList.contains("is-active")).toBe(true);
    expect(tab(t.el, "a").getAttribute("aria-selected")).toBe("true");
    expect(tab(t.el, "b").textContent).toBe("B3");
    key(t.el, "ArrowLeft");
    expect(onSelect).toHaveBeenLastCalledWith("c");
    key(t.el, "ArrowRight");
    expect(onSelect).toHaveBeenLastCalledWith("a");
    key(t.el, "End");
    expect(onSelect).toHaveBeenLastCalledWith("c");
    key(t.el, "Home");
    expect(onSelect).toHaveBeenLastCalledWith("a");
    tab(t.el, "b").click();
    expect(onSelect).toHaveBeenLastCalledWith("b");
    expect(tab(t.el, "b").tabIndex).toBe(0);
    expect(tab(t.el, "a").tabIndex).toBe(-1);
    const calls = onSelect.mock.calls.length;
    tab(t.el, "b").click();
    expect(onSelect).toHaveBeenCalledTimes(calls);
  });

  it("with a value that is no tab id, nothing is selected and the first tab is focusable", () => {
    const t = tabs(host(), { tabs: spec, value: "zzz" as never, onSelect: () => {} });
    expect(t.el.querySelectorAll(".is-active")).toHaveLength(0);
    expect([...t.el.querySelectorAll<HTMLButtonElement>(".hel-tab")].map((b) => b.tabIndex)).toEqual([0, -1, -1]);
  });

  it("setValue moves the selection silently; setBadge updates, adds and hides badges", () => {
    const onSelect = vi.fn();
    const t = tabs(host(), { tabs: spec, value: "a", onSelect });
    t.setValue("c");
    expect(tab(t.el, "c").classList.contains("is-active")).toBe(true);
    expect(tab(t.el, "a").classList.contains("is-active")).toBe(false);
    t.setValue("zzz" as never);
    expect(tab(t.el, "c").classList.contains("is-active")).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    t.setBadge("b", 7);
    expect(tab(t.el, "b").querySelector(".hel-tab-badge")!.textContent).toBe("7");
    t.setBadge("b", 0);
    expect(tab(t.el, "b").querySelector<HTMLElement>(".hel-tab-badge")!.hidden).toBe(true);
    t.setBadge("a", 1);
    expect(tab(t.el, "a").querySelector(".hel-tab-badge")!.textContent).toBe("1");
  });
});
