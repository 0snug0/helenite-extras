import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRow, renderIcon, setBridge, type HostUi, type IconShape } from "../src";

const SQUARE: IconShape[] = [["rect", { width: "18", height: "18", x: "3", y: "3" }]];
const LINE: IconShape[] = [["path", { d: "M3 12h18" }]];
const settle = () => new Promise((r) => setTimeout(r, 0));
/** A fake host that knows `known`. Answers are cached per bridge, so each test starts with a new one. */
const bridge = (known: Record<string, IconShape[]>) => {
  const icons = vi.fn(async (names: string[]) => Object.fromEntries(names.filter((n) => Object.hasOwn(known, n)).map((n) => [n, known[n]!])));
  return { api: { ui: { icons } as unknown as HostUi }, icons };
};
const span = () => document.body.appendChild(document.createElement("span"));

describe("icons the host draws", () => {
  // The first test to run needs no bridge, and names asked for without one wait for the next: use fresh names per test.
  beforeEach(() => { setBridge(null); document.body.innerHTML = ""; });

  it("asks the host once for every unknown name drawn together, and draws the answers", async () => {
    const { api, icons } = bridge({ terminal: LINE, "file-text": SQUARE });
    setBridge(api);
    const a = span(), b = span(), c = span();
    renderIcon(a, "terminal");
    renderIcon(b, "file-text");
    renderIcon(c, "terminal");
    await settle();
    expect(icons.mock.calls).toEqual([[["terminal", "file-text"]]]);
    for (const el of [a, c]) expect(el.querySelector("svg.svg-icon.lucide-terminal > path")).not.toBeNull();
    expect(b.querySelector("svg.lucide-file-text > rect")).not.toBeNull();
  });

  it("draws a name it has had an answer for at once, without asking again", async () => {
    const { api, icons } = bridge({ palette: LINE });
    setBridge(api);
    renderIcon(span(), "palette");
    await settle();
    const el = span();
    renderIcon(el, "palette");
    expect(el.querySelector("svg.lucide-palette")).not.toBeNull();
    await settle();
    expect(icons).toHaveBeenCalledTimes(1);
  });

  it("draws icons rendered before setBridge once it is called", async () => {
    const el = span();
    renderIcon(el, "keyboard");
    await settle();
    expect(el.childElementCount).toBe(0);
    setBridge(bridge({ keyboard: SQUARE }).api);
    await settle();
    expect(el.querySelector("svg.lucide-keyboard")).not.toBeNull();
  });

  it("draws a part's icon (a list row)", async () => {
    setBridge(bridge({ pencil: LINE }).api);
    const row = listRow(document.body, { title: "Edit", icon: "pencil" });
    await settle();
    expect(row.querySelector("svg.lucide-pencil")).not.toBeNull();
  });

  it("does not put a late answer over a newer icon", async () => {
    setBridge(bridge({ anchor: LINE }).api);
    const el = span();
    renderIcon(el, "anchor");
    renderIcon(el, "x");
    await settle();
    expect(el.querySelectorAll("svg")).toHaveLength(1);
    expect(el.querySelector("svg")!.classList.contains("lucide-x")).toBe(true);
  });

  it("removes the previous icon while the new name is unanswered, and nothing else", () => {
    setBridge(bridge({}).api);
    const el = span();
    renderIcon(el, "x");
    el.append("label");
    renderIcon(el, "atom");
    expect(el.querySelector("svg")).toBeNull();
    expect(el.textContent).toBe("label");
  });

  it("keeps what was added to the element while it waited", async () => {
    setBridge(bridge({ star: LINE }).api);
    const el = span();
    renderIcon(el, "star");
    el.append("Edit");
    await settle();
    expect(el.firstElementChild!.matches("svg.lucide-star")).toBe(true);
    expect(el.textContent).toBe("Edit");
  });

  it("remembers that the host does not know a name", async () => {
    const { api, icons } = bridge({});
    setBridge(api);
    const el = span();
    renderIcon(el, "not-an-icon");
    await settle();
    renderIcon(span(), "not-an-icon");
    await settle();
    expect(icons).toHaveBeenCalledTimes(1);
    expect(el.dataset.icon).toBe("not-an-icon");
    expect(el.childElementCount).toBe(0);
  });

  it("asks again after a failed call", async () => {
    const icons = vi.fn<(n: string[]) => Promise<Record<string, IconShape[]>>>().mockRejectedValueOnce(new Error("no")).mockResolvedValue({ bell: LINE });
    setBridge({ ui: { icons } as unknown as HostUi });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderIcon(span(), "bell");
    await settle();
    expect(error).toHaveBeenCalledTimes(1);
    const el = span();
    renderIcon(el, "bell");
    await settle();
    expect(el.querySelector("svg.lucide-bell")).not.toBeNull();
    error.mockRestore();
  });

  it("only tags the element on a host that cannot draw icons", async () => {
    setBridge({ ui: {} as HostUi });
    const el = span();
    renderIcon(el, "cloud");
    await settle();
    expect(el.dataset.icon).toBe("cloud");
    expect(el.childElementCount).toBe(0);
  });

  it("splits a long list into calls the host accepts, and never asks for a malformed name", async () => {
    const { api, icons } = bridge({});
    setBridge({ ui: {} as HostUi }); // drains what earlier tests left waiting
    await settle();
    setBridge(api);
    await settle();
    icons.mockClear();
    for (let i = 0; i < 150; i++) renderIcon(span(), `many-${i}`);
    renderIcon(span(), "Not A Name");
    renderIcon(span(), "");
    await settle();
    expect(icons.mock.calls.map((c) => c[0].length)).toEqual([100, 50]);
  });

  it("takes the lucide- prefix", async () => {
    const { api, icons } = bridge({ moon: LINE });
    setBridge(api);
    const a = span(), b = span();
    renderIcon(a, "lucide-moon");
    renderIcon(b, "lucide-x");
    await settle();
    expect(a.querySelector("svg.lucide-moon")).not.toBeNull();
    expect(b.querySelector("svg.lucide-x")).not.toBeNull();
    expect(icons.mock.calls).toEqual([[["moon"]]]);
  });

  it("treats a name like an object property as any other", async () => {
    setBridge(bridge({}).api);
    const el = span();
    renderIcon(el, "constructor");
    await settle();
    expect(el.childElementCount).toBe(0);
  });
});
