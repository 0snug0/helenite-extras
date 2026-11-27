// The composer's "/" menu while its commands load, and when a load fails or finds none.
import { afterEach, describe, expect, it, vi } from "vitest";
import { composer } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const typeIn = (input: { value: string; setSelectionRange(a: number, b: number): void; dispatchEvent(e: Event): boolean }, v: string) => {
  input.value = v;
  input.setSelectionRange(v.length, v.length);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const names = (el: HTMLElement) => [...el.querySelectorAll(".hel-composer-menu-name")].map((n) => n.textContent);
const later = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("composer '/' menu loading", () => {
  it("shows one loading row while a slow load runs, fetches once while typing, then lists the commands", async () => {
    vi.useFakeTimers();
    const slow = later<{ name: string }[]>();
    const load = vi.fn(() => slow.promise);
    const c = composer(host(), { onSubmit: () => {}, slashCommands: load });
    const menu = c.el.querySelector<HTMLElement>(".hel-composer-menu")!;
    c.input.focus();
    typeIn(c.input, "/");
    // A fast load never shows a loading row.
    expect(menu.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(menu.hidden).toBe(false);
    const row = menu.querySelector(".hel-loading");
    expect(row?.textContent).toContain("Loading commands");
    typeIn(c.input, "/re");
    typeIn(c.input, "/rev");
    expect(load).toHaveBeenCalledTimes(1);
    expect(menu.querySelector(".hel-loading")).toBe(row);
    // Enter while it loads picks nothing.
    key(c.input, "Enter");
    expect(c.input.value).toBe("/rev");
    slow.resolve([{ name: "review" }, { name: "notes" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(menu.querySelector(".hel-loading")).toBeNull();
    expect(names(c.el)).toEqual(["/review"]);
  });

  it("a fast load shows the list with no loading row in between", async () => {
    const load = vi.fn(async () => [{ name: "review" }]);
    const c = composer(host(), { onSubmit: () => {}, slashCommands: load });
    c.input.focus();
    typeIn(c.input, "/");
    await new Promise((r) => setTimeout(r, 0));
    expect(c.el.querySelector(".hel-loading")).toBeNull();
    expect(names(c.el)).toEqual(["/review"]);
  });

  it("an empty list is not kept: the menu stays shut and the next keystroke asks again", async () => {
    const load = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([{ name: "review" }]);
    const c = composer(host(), { onSubmit: () => {}, slashCommands: load });
    const menu = c.el.querySelector<HTMLElement>(".hel-composer-menu")!;
    c.input.focus();
    typeIn(c.input, "/");
    await new Promise((r) => setTimeout(r, 0));
    expect(menu.hidden).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    typeIn(c.input, "/r");
    await new Promise((r) => setTimeout(r, 0));
    expect(load).toHaveBeenCalledTimes(2);
    expect(names(c.el)).toEqual(["/review"]);
    // Kept now: no third load.
    typeIn(c.input, "/re");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a failed load shows an error with a retry, and is not kept", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn().mockRejectedValueOnce(new Error("bridge down")).mockResolvedValue([{ name: "review" }]);
    const c = composer(host(), { onSubmit: () => {}, slashCommands: load });
    const menu = c.el.querySelector<HTMLElement>(".hel-composer-menu")!;
    c.input.focus();
    typeIn(c.input, "/");
    await new Promise((r) => setTimeout(r, 0));
    expect(menu.hidden).toBe(false);
    expect(menu.querySelector(".hel-error")!.textContent).toContain("Could not load commands");
    expect(load).toHaveBeenCalledTimes(1);
    key(c.input, "Enter");
    expect(c.input.value).toBe("/");
    menu.querySelector<HTMLButtonElement>(".hel-error button")!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(load).toHaveBeenCalledTimes(2);
    expect(menu.querySelector(".hel-error")).toBeNull();
    expect(names(c.el)).toEqual(["/review"]);
  });
});
