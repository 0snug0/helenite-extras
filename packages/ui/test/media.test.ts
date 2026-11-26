import { afterEach, describe, expect, it, vi } from "vitest";
import { artwork, barChart, button, figures, mediaCard, mediaGrid, meter, monthGrid, rating, sectionHeading, statTiles, table, toolbar } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
const q = <T extends Element = HTMLElement>(el: Element, s: string) => el.querySelector<T & HTMLElement>(s)!;
const all = (el: Element, s: string) => [...el.querySelectorAll<HTMLElement>(s)];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("artwork and media cards", () => {
  it("shows the picture as a named background image, or the title where there is none", () => {
    const pic = artwork(host(), { title: "Heat", src: 'http://x/a"b.jpg', label: "Heat on Letterboxd" });
    const image = q(pic, ".hel-art-image");
    expect(image.getAttribute("aria-label")).toBe("Heat on Letterboxd");
    expect(image.style.backgroundImage).toContain("a%22b.jpg");
    expect(image.textContent).toBe("");
    const none = artwork(host(), { title: "Heat" });
    expect(none.classList.contains("is-missing")).toBe(true);
    expect(none.textContent).toBe("Heat");
    expect(none.tagName).toBe("DIV");
  });

  it("a clickable artwork is a link that calls onClick and never navigates or bubbles", () => {
    const h = host();
    const outer = vi.fn();
    h.addEventListener("click", outer);
    const onClick = vi.fn();
    const a = artwork(h, { title: "Heat", onClick, tooltip: "Heat on Letterboxd" });
    const e = new MouseEvent("click", { bubbles: true, cancelable: true });
    a.dispatchEvent(e);
    expect(a.tagName).toBe("A");
    expect(a.title).toBe("Heat on Letterboxd");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
  });

  it("a media card is a card led by its artwork, with the variants as classes", () => {
    const grid = mediaGrid(host(), { layout: "strip", minWidth: 120 });
    expect(grid.classList.contains("is-strip")).toBe(true);
    expect(grid.style.getPropertyValue("--hel-media-min")).toBe("120px");
    const c = mediaCard(grid, { art: { title: "Heat" }, title: "Heat", detail: "A film", selected: true, focused: true, plain: true });
    expect([...c.el.classList]).toEqual(expect.arrayContaining(["hel-card", "hel-media-card", "is-tile", "is-plain", "is-focused", "is-accent"]));
    expect(c.el.firstElementChild!.nextElementSibling).toBe(c.art);
    expect(c.art.nextElementSibling).toBe(c.body);
    expect(q(c.body, ".hel-media-title").textContent).toBe("Heat");
    expect(q(c.body, ".hel-media-detail").textContent).toBe("A film");
    expect(mediaCard(grid, { art: { title: "x" }, layout: "row" }).el.classList.contains("is-row")).toBe(true);
  });
});

describe("figures, rating, stat tiles and headings", () => {
  it("links only the figures that have an action, and names each", () => {
    const onClick = vi.fn();
    const icon = document.createElement("b");
    const el = figures(host(), [{ text: "92%", label: "Critics", onClick, key: "rt", icon }, { text: "–" }], { columns: 2 });
    const [a, b] = all(el, ".hel-figure");
    expect(el.classList.contains("is-columns")).toBe(true);
    expect(a!.tagName).toBe("A");
    expect(a!.getAttribute("aria-label")).toBe("Critics: 92%");
    expect(a!.dataset.key).toBe("rt");
    expect(a!.querySelector(".hel-figure-icon b")).toBe(icon);
    a!.click();
    expect(onClick).toHaveBeenCalled();
    expect(b!.tagName).toBe("SPAN");
  });

  it("fills the stars to the value and keeps an unrated one empty", () => {
    const r = rating(host(), { value: 3.5 });
    expect(r.getAttribute("aria-label")).toBe("3.5 of 5 stars");
    expect(q(r, ".hel-rating-fill").style.width).toBe("70%");
    expect(q(rating(host(), { value: 9 }), ".hel-rating-fill").style.width).toBe("100%");
    const none = rating(host(), { value: null });
    expect(none.classList.contains("is-none")).toBe(true);
    expect(none.children.length).toBe(0);
  });

  it("makes a tile a button only when it has an action", () => {
    const onClick = vi.fn();
    const el = statTiles(host(), [{ value: "8", label: "Films", onClick }, { value: "1", label: "Streak" }]);
    const [a, b] = all(el, ".hel-stat");
    expect(a!.tagName).toBe("BUTTON");
    a!.click();
    expect(onClick).toHaveBeenCalled();
    expect(b!.tagName).toBe("DIV");
    expect(b!.textContent).toBe("1Streak");
  });

  it("draws a heading of the level asked for, with a slot for buttons", () => {
    const h = sectionHeading(host(), { title: "Ratings", extra: "avg 3", level: 3 });
    expect(h.titleEl.tagName).toBe("H3");
    expect(q(h.el, ".hel-heading-extra").textContent).toBe("avg 3");
    expect(h.actions.childElementCount).toBe(0);
    expect(sectionHeading(host(), { title: "Home" }).titleEl.tagName).toBe("H2");
  });
});

describe("monthGrid", () => {
  const events = (day: string) => (day === "2026-11-14" ? ["A", "B", "C", "D"].map((title) => ({ title, lead: "4.0", onClick: () => {} })) : day === "2026-11-03" ? [{ title: "Solo" }] : []);
  const draw = (extra = {}) => monthGrid(host(), { month: new Date(2026, 10, 20), today: new Date(2026, 10, 18), events, ...extra });

  it("starts on Monday, pads to whole weeks and marks today and the other months", () => {
    const el = draw();
    const days = all(el, ".hel-month-day");
    expect(all(el, ".hel-month-weekday")).toHaveLength(7);
    expect(days).toHaveLength(42);
    expect(days[0]!.dataset.day).toBe("2026-10-26");
    expect(days[0]!.classList.contains("is-outside")).toBe(true);
    expect(q(el, ".is-today").dataset.day).toBe("2026-11-18");
    expect(all(draw({ weekStart: 0 }), ".hel-month-day")[0]!.dataset.day).toBe("2026-11-01");
  });

  it("cuts a full day to max rows and opens every event from +N more", () => {
    const el = draw();
    const full = q(el, '[data-day="2026-11-14"]');
    expect(all(full, ".hel-month-event")).toHaveLength(2);
    const more = q(full, ".hel-month-more");
    expect(more.textContent).toBe("+2 more");
    more.click();
    expect(all(document.body, ".hel-popover .hel-month-event")).toHaveLength(4);
    expect(q(el, '[data-day="2026-11-03"] .hel-month-event').tagName).toBe("DIV");
  });
});

describe("table sorting and trees", () => {
  it("sorts from the header, marks the sorted column and moves the mark", () => {
    const onSort = vi.fn();
    const t = table(host(), {
      columns: [{ key: "a", title: "Title", sortable: true, cell: (r: string) => r }, { key: "b", title: "", headTitle: "Score", sortable: true, align: "end", head: (el) => { el.append("★"); }, cell: () => "1" }],
      rows: ["x"], sort: { key: "a", dir: "asc" }, onSort,
    });
    const [a, b] = all(t.el, "th");
    expect(a!.getAttribute("aria-sort")).toBe("ascending");
    expect(b!.getAttribute("aria-sort")).toBeNull();
    expect(q(b!, "button").getAttribute("aria-label")).toBe("Score");
    expect(b!.textContent).toBe("★");
    q(b!, "button").click();
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith("b");
    a!.click();
    expect(onSort).toHaveBeenLastCalledWith("a");
    t.setSort({ key: "b", dir: "desc" });
    expect(a!.getAttribute("aria-sort")).toBeNull();
    expect(b!.getAttribute("aria-sort")).toBe("descending");
  });

  it("sets widths, nests and dims rows, and scrolls when it has a minimum width", () => {
    const h = host();
    const t = table(h, {
      columns: [{ key: "a", title: "A", width: "40px", truncate: true, tree: true, cell: (r: number) => String(r) }],
      rows: [0, 1, 2], rowLevel: (r) => r, rowMuted: (r) => r === 2, fixed: true, minWidth: "900px",
    });
    expect(h.firstElementChild!.classList.contains("hel-table-scroll")).toBe(true);
    expect(t.el.style.minWidth).toBe("900px");
    expect(q(t.el, "col").style.width).toBe("40px");
    const rows = all(t.el, "tbody tr");
    expect(rows.map((r) => r.dataset.level)).toEqual([undefined, "1", "2"]);
    expect(rows[2]!.classList.contains("is-muted")).toBe(true);
    expect([...q(rows[0]!, "td").classList]).toEqual(["is-truncate", "is-tree"]);
  });
});

describe("meter, bar chart, button and toolbar additions", () => {
  it("shows a bare meter's reading beside it when asked", () => {
    const m = meter(host(), { layout: "bar", label: "Progress", value: 40, text: "40%", showText: true });
    expect(m.classList.contains("has-text")).toBe(true);
    expect(q(m, ".hel-meter-text").textContent).toBe("40%");
    expect(meter(host(), { layout: "bar", label: "Progress", value: 40, text: "40%" }).querySelector(".hel-meter-text")).toBeNull();
  });

  it("makes columns with a value selectable, names them all and mutes the ones to come", () => {
    const onSelect = vi.fn();
    const el = barChart(host(), { label: "Per day", labels: "all", onSelect, buckets: [{ key: "1", label: "M", value: 2 }, { key: "2", label: "T", value: 0 }, { key: "3", label: "W", value: 5, muted: true }] });
    const [a, b, c] = all(el, ".hel-bar-chart-col");
    expect(q(el, ".hel-bar-chart-plot").getAttribute("role")).toBe("group");
    expect(a!.tagName).toBe("BUTTON");
    expect(b!.tagName).toBe("DIV");
    expect(c!.classList.contains("is-muted")).toBe(true);
    expect(c!.querySelector(".hel-bar-chart-bar")).toBeNull();
    a!.click();
    expect(onSelect.mock.calls[0]![0].key).toBe("1");
    expect(all(el, ".hel-bar-chart-axis > span").map((s) => s.textContent)).toEqual(["M", "T", "W"]);
  });

  it("marks an armed button and a sticky toolbar", () => {
    expect(button(host(), { text: "x", armed: true }).el.classList.contains("is-armed")).toBe(true);
    expect(toolbar(host(), { sticky: true }).classList.contains("is-sticky")).toBe(true);
  });
});
