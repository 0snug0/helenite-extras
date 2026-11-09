import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { badge, button, calendarStrip, cardGrid, checkbox, emptyState, errorState, field, installObsidianDom, isoDay, picker, posterRow, searchInput, select, sortRows, sortableTable, tabs, textInput, toggle } from "../src";

const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const col = (t: HTMLElement, i: number) => [...t.querySelectorAll("tbody tr")].map((r) => r.children[i].textContent);

describe("sortableTable", () => {
  const rows = [{ t: "b", n: 2, d: "2024-02-01" }, { t: "a", n: 10, d: "2023-01-01" }, { t: "c", n: null as number | null, d: "" }, { t: "d", n: 1, d: "2025-06-01" }];
  const make = (extra = {}) => sortableTable({
    columns: [{ key: "t", label: "Title", sort: "string" }, { key: "n", label: "N", sort: "number", align: "right" }, { key: "d", label: "Date", sort: "date" }, { key: "x", label: "Static", render: (r) => `#${r.t}` }],
    rows, ...extra,
  });

  it("renders headers with aria-sort and sorts on click, toggling direction", () => {
    const onSort = vi.fn();
    const t = make({ onSort });
    document.body.append(t.el);
    const btn = (k: number) => t.el.querySelectorAll("th")[k].querySelector("button") as HTMLElement;
    btn(0).click();
    expect(col(t.el, 0)).toEqual(["a", "b", "c", "d"]);
    expect(t.el.querySelectorAll("th")[0].getAttribute("aria-sort")).toBe("ascending");
    btn(0).click();
    expect(col(t.el, 0)).toEqual(["d", "c", "b", "a"]);
    expect(onSort).toHaveBeenLastCalledWith({ key: "t", dir: "desc" });
    expect(t.el.querySelectorAll("th")[3].querySelector("button")).toBeNull();
    expect(t.el.querySelectorAll("th")[3].hasAttribute("aria-sort")).toBe(false);
  });

  it("numeric sort is numeric and blanks go last in both directions", () => {
    const col2 = { key: "n", label: "N", sort: "number" as const };
    expect(sortRows(rows, col2, "asc").map((r) => r.n)).toEqual([1, 2, 10, null]);
    expect(sortRows(rows, col2, "desc").map((r) => r.n)).toEqual([10, 2, 1, null]);
    expect(sortRows(rows, { key: "d", label: "D", sort: "date" }, "asc").map((r) => r.t)).toEqual(["a", "b", "d", "c"]);
  });

  it("is stable, supports custom comparators, and never mutates the input", () => {
    const copy = [...rows];
    sortRows(rows, { key: "t", label: "T", sort: (a, b) => a.t.localeCompare(b.t) }, "desc");
    expect(rows).toEqual(copy);
    expect(sortRows([{ k: 1, i: 0 }, { k: 1, i: 1 }, { k: 0, i: 2 }], { key: "k", label: "k", sort: "number" }, "asc").map((r) => r.i)).toEqual([2, 0, 1]);
  });

  it("setRows redraws under the current sort; empty rows show the empty cell; row click skips buttons", () => {
    const onRowClick = vi.fn();
    const t = make({ sort: { key: "n", dir: "asc" }, onRowClick, empty: "Nothing here" });
    document.body.append(t.el);
    expect(col(t.el, 1)).toEqual(["1", "2", "10", ""]);
    t.setRows([]);
    expect(t.el.querySelector(".hk-table-empty")!.textContent).toBe("Nothing here");
    t.setRows(rows);
    (t.el.querySelector("tbody tr") as HTMLElement).click();
    expect(onRowClick).toHaveBeenCalledWith(rows[3]);
  });

  it("escapes cell text (no HTML injection)", () => {
    const t = sortableTable({ columns: [{ key: "t", label: "T" }], rows: [{ t: "<img src=x onerror=alert(1)>" }] });
    expect(t.el.querySelector("img")).toBeNull();
    expect(t.el.querySelector("td")!.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("cards and posters", () => {
  const items = [{ id: "1", title: "Alien", subtitle: "1979", image: "https://image.tmdb.org/a.jpg", badges: ["4K"] }, { id: "2", title: "Brazil" }];
  it("cardGrid renders cards, selects, removes, and falls back to an initial when the image fails", () => {
    const onSelect = vi.fn(), onRemove = vi.fn();
    const g = cardGrid({ items, onSelect, onRemove, minWidth: 120 });
    document.body.append(g.el);
    expect(g.el.style.getPropertyValue("--hk-card-min")).toBe("120px");
    expect(g.el.querySelectorAll(".hk-card")).toHaveLength(2);
    (g.el.querySelector("[data-id='1'] .hk-card-main") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    (g.el.querySelector("[data-id='2'] .hk-card-remove") as HTMLElement).click();
    expect(onRemove).toHaveBeenCalledWith(items[1]);
    expect(g.el.querySelector("[data-id='2'] .hk-poster-initial")!.textContent).toBe("B");
    g.el.querySelector("[data-id='1'] img")!.dispatchEvent(new Event("error"));
    expect(g.el.querySelector("[data-id='1'] .is-fallback")).not.toBeNull();
  });
  it("cardGrid shows the empty node and updates with setItems", () => {
    const g = cardGrid({ items: [], empty: emptyState({ title: "No films" }) });
    expect(g.el.textContent).toContain("No films");
    g.setItems(items);
    expect(g.el.querySelectorAll(".hk-card")).toHaveLength(2);
  });
  it("posterRow renders a titled, scrollable list of posters", () => {
    const onSelect = vi.fn();
    const r = posterRow({ title: "Recommended", items, onSelect });
    expect(r.el.querySelector("h3")!.textContent).toBe("Recommended");
    (r.el.querySelectorAll(".hk-poster-item")[1] as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(r.el.querySelector(".hk-row-track")!.getAttribute("role")).toBe("list");
  });
});

describe("picker", () => {
  const options = [{ value: "a", label: "Alpha 1080p", detail: "4 GB" }, { value: "b", label: "Beta 720p" }, { value: "c", label: "Gamma", disabled: true }];
  it("selects by click, skips disabled, and filters", () => {
    const onChange = vi.fn();
    const p = picker({ options, searchable: true, onChange });
    document.body.append(p.el);
    (p.el.querySelector("[data-value='b']") as HTMLElement).click();
    expect(p.value()).toBe("b");
    (p.el.querySelector("[data-value='c']") as HTMLElement).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    const s = p.el.querySelector("input") as HTMLInputElement;
    s.value = "4 gb"; s.dispatchEvent(new Event("input"));
    expect(p.el.querySelectorAll("[role=option]")).toHaveLength(1);
    s.value = "zzz"; s.dispatchEvent(new Event("input"));
    expect(p.el.querySelector(".hk-option-none")).not.toBeNull();
  });
  it("arrow keys move the active row and Enter chooses it", () => {
    const onChange = vi.fn();
    const p = picker({ options, onChange });
    key(p.el, "ArrowDown"); key(p.el, "Enter");
    expect(onChange).toHaveBeenCalledWith("b");
    key(p.el, "ArrowUp"); key(p.el, "Enter");
    expect(onChange).toHaveBeenLastCalledWith("a");
    expect(p.el.querySelector("[aria-selected=true]")!.getAttribute("data-value")).toBe("a");
  });
});

describe("tabs", () => {
  it("selects by click and with arrow keys (roving tabindex, wrapping)", () => {
    const onSelect = vi.fn();
    const t = tabs({ tabs: [{ id: "a", label: "A" }, { id: "b", label: "B", badge: 3 }, { id: "c", label: "C" }], onSelect });
    document.body.append(t.el);
    expect(t.value()).toBe("a");
    expect(t.el.querySelector("[data-tab=b]")!.textContent).toBe("B3");
    key(t.el, "ArrowLeft");
    expect(t.value()).toBe("c");
    key(t.el, "ArrowRight");
    expect(t.value()).toBe("a");
    (t.el.querySelector("[data-tab=b]") as HTMLElement).click();
    expect(onSelect).toHaveBeenLastCalledWith("b");
    expect(t.el.querySelector("[data-tab=b]")!.getAttribute("tabindex")).toBe("0");
    expect(t.el.querySelector("[data-tab=a]")!.getAttribute("tabindex")).toBe("-1");
    expect(t.el.getAttribute("role")).toBe("tablist");
    t.select("zzz");
    expect(t.value()).toBe("b");
  });
});

describe("form controls", () => {
  it("fire callbacks and keep values", () => {
    const onClick = vi.fn(), onInput = vi.fn(), onEnter = vi.fn(), onSel = vi.fn(), onChk = vi.fn(), onTog = vi.fn();
    const b = button({ label: "Go", primary: true, onClick });
    b.click();
    expect(onClick).toHaveBeenCalled();
    expect(b.className).toContain("hk-btn-primary");
    const i = textInput({ value: "x", onInput, onEnter });
    expect(i.value).toBe("x");
    i.value = "y"; i.dispatchEvent(new Event("input")); key(i, "Enter");
    expect(onInput).toHaveBeenCalledWith("y"); expect(onEnter).toHaveBeenCalledWith("y");
    const s = select({ options: [{ value: "1", label: "One" }, { value: "2", label: "Two" }], value: "2", onChange: onSel });
    expect(s.value).toBe("2");
    s.value = "1"; s.dispatchEvent(new Event("change"));
    expect(onSel).toHaveBeenCalledWith("1");
    const c = checkbox({ label: "On", checked: true, onChange: onChk });
    const ci = c.querySelector("input")!; ci.checked = false; ci.dispatchEvent(new Event("change"));
    expect(onChk).toHaveBeenCalledWith(false);
    const t = toggle({ label: "T", onChange: onTog });
    t.click(); t.click();
    expect(onTog.mock.calls).toEqual([[true], [false]]);
    expect(badge("ok", "good").className).toContain("hk-badge-good");
  });
  it("field links label and control by id", () => {
    const f = field("Name", textInput({}), "hint");
    const input = f.querySelector("input")!;
    expect(f.querySelector("label")!.getAttribute("for")).toBe(input.id);
    expect(f.querySelector(".hk-field-hint")!.textContent).toBe("hint");
  });
  it("searchInput debounces", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const s = searchInput({ delayMs: 100, onSearch });
    for (const v of ["a", "ab", "abc"]) { s.value = v; s.dispatchEvent(new Event("input")); }
    vi.advanceTimersByTime(99); expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2); expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("abc");
    vi.useRealTimers();
  });
});

describe("calendarStrip", () => {
  const today = new Date(2026, 10, 9); // Mon 9 Nov 2026, local
  it("renders consecutive local days with events, today and selection", () => {
    const onSelect = vi.fn();
    const ev = [{ date: "2026-11-10", title: "Standup" }, { date: "2026-11-10", title: "Lunch", kind: "busy" }, { date: "2026-11-12", title: "Dentist" }];
    const c = calendarStrip({ today, start: today, days: 5, events: ev, onSelect });
    expect(c.el.querySelectorAll(".hk-cal-day")).toHaveLength(5);
    expect(c.el.querySelector("[data-day='2026-11-09']")!.classList.contains("is-today")).toBe(true);
    expect(c.el.querySelectorAll("[data-day='2026-11-10'] .hk-dot")).toHaveLength(2);
    (c.el.querySelector("[data-day='2026-11-10']") as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledWith("2026-11-10", ev.slice(0, 2));
    expect(c.el.querySelector("[data-day='2026-11-10']")!.getAttribute("aria-pressed")).toBe("true");
    expect(c.el.querySelector("[data-day='2026-11-10']")!.getAttribute("aria-label")).toContain("2 events");
  });
  it("crosses month and DST boundaries without skipping a day, and isoDay is local", () => {
    const c = calendarStrip({ start: new Date(2026, 9, 30), days: 5, today });
    expect([...c.el.querySelectorAll("[data-day]")].map((e) => e.getAttribute("data-day"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(isoDay(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });
});

describe("states", () => {
  it("empty is a status; error is an alert with a working action and collapsed detail", () => {
    const onAction = vi.fn();
    const e = emptyState({ title: "No films", message: "Add one", icon: "🎬" });
    expect(e.getAttribute("role")).toBe("status");
    const er = errorState({ title: "Radarr unreachable", message: "Check the URL", actionLabel: "Retry", onAction, detail: "ECONNREFUSED" });
    expect(er.getAttribute("role")).toBe("alert");
    (er.querySelector("button") as HTMLElement).click();
    expect(onAction).toHaveBeenCalled();
    expect(er.querySelector("details pre")!.textContent).toBe("ECONNREFUSED");
  });
});

describe("Obsidian DOM helpers", () => {
  it("installs createDiv/createEl/empty/addClass/setText for ported code", () => {
    installObsidianDom(window as any);
    const root = (window as any).createDiv({ cls: "root" });
    const kid = root.createEl("span", { text: "hi", cls: ["a", "b"], attr: { "data-x": "1" } });
    expect(root.querySelector("span.a.b[data-x='1']")!.textContent).toBe("hi");
    kid.addClass("c"); kid.toggleClass("d", true);
    expect(kid.hasClass("c") && kid.hasClass("d")).toBe(true);
    root.createDiv("plain").setText("t");
    expect(root.querySelector(".plain")!.textContent).toBe("t");
    root.empty();
    expect(root.children).toHaveLength(0);
  });
});

describe("theme and sandbox hygiene", () => {
  const src = join(__dirname, "../src");
  const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]));
  it("the stylesheet uses theme variables only (no literal colours)", () => {
    const css = readFileSync(join(src, "ui-kit.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/);
    const named = css.match(/(?:color|background|border[\w-]*|outline|fill|stroke)\s*:\s*[^;]*/g) ?? [];
    for (const decl of named) expect(decl).not.toMatch(/:\s*(?:\S+\s+)*(red|green|blue|white|black|gray|grey|orange|yellow)\b/);
    expect(css).toContain("var(--background-primary)");
  });
  it("no source uses innerHTML, eval, network, storage or window.open (frame-safe)", () => {
    for (const f of files(src).filter((x) => x.endsWith(".ts"))) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|\bfetch\(|XMLHttpRequest|localStorage|sessionStorage|window\.open|document\.cookie/);
    }
  });
});
