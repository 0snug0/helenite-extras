import { describe, expect, it, vi } from "vitest";
import { table } from "../src";

const host = () => document.body.appendChild(document.createElement("div"));
type R = { name: string; n: number };
const cols = [
  { key: "name", title: "Name", cell: (r: R) => r.name },
  { key: "n", title: "Count", cell: (r: R) => String(r.n) },
];
const rows: R[] = [{ name: "a", n: 1 }, { name: "b", n: 2 }];

describe("table", () => {
  it("renders thead th per column title, tbody tr.hel-table-row per row with td text from cell()", () => {
    const t = table(host(), { columns: cols, rows });
    expect(t.el.classList.contains("hel-table")).toBe(true);
    expect([...t.el.querySelectorAll("thead th")].map((e) => e.textContent)).toEqual(["Name", "Count"]);
    const trs = t.el.querySelectorAll("tbody tr.hel-table-row");
    expect(trs.length).toBe(2);
    expect([...trs[1].querySelectorAll("td")].map((e) => e.textContent)).toEqual(["b", "2"]);
  });

  it("fit marks the column's th and every td is-fit, alongside its className; other columns have no is-fit", () => {
    const t = table(host(), {
      columns: [cols[0], { ...cols[1], fit: true, className: "count" }],
      rows,
      groups: [{ title: "G", rows: [rows[0]] }],
    });
    const fit = (el: Element) => el.classList.contains("is-fit");
    expect([...t.el.querySelectorAll("thead th")].map(fit)).toEqual([false, true]);
    expect(t.el.querySelector("thead th.is-fit")!.classList.contains("count")).toBe(true);
    for (const tr of t.el.querySelectorAll("tbody tr.hel-table-row")) expect([...tr.querySelectorAll("td")].map(fit)).toEqual([false, true]);
    expect(fit(t.el.querySelector("tr.hel-table-group td")!)).toBe(false);
    t.setRows([rows[1]]);
    expect([...t.el.querySelectorAll("tbody td")].map(fit)).toEqual([false, true]);
  });

  it("without fit no cell is-fit", () => {
    const t = table(host(), { columns: cols, rows, actions: () => {} });
    expect(t.el.querySelectorAll(".is-fit").length).toBe(0);
  });

  it("a cell() that returns void leaves td for it to fill (no text set)", () => {
    const t = table(host(), {
      columns: [{ key: "x", title: "X", cell: (r: R, td) => void td.appendChild(document.createElement("input")) }],
      rows,
    });
    const td = t.el.querySelector("tbody td")!;
    expect(td.querySelector("input")).not.toBeNull();
    expect(td.textContent).toBe("");
  });

  it("groups render tr.hel-table-group with one td colspan = columns + (actions ? 1 : 0)", () => {
    const t = table(host(), {
      columns: cols,
      groups: [{ title: "G1", rows }, { title: (td) => void (td.textContent = "G2"), rows: [rows[0]] }],
      actions: () => {},
    });
    const gs = t.el.querySelectorAll("tr.hel-table-group");
    expect(gs.length).toBe(2);
    expect(gs[0].querySelectorAll("td").length).toBe(1);
    expect(gs[0].querySelector("td")!.getAttribute("colspan")).toBe("3");
    expect(gs[0].textContent).toBe("G1");
    expect(gs[1].textContent).toBe("G2");
    expect(t.el.querySelectorAll("tr.hel-table-row").length).toBe(3);
    const t2 = table(host(), { columns: cols, groups: [{ title: "G", rows }] });
    expect(t2.el.querySelector("tr.hel-table-group td")!.getAttribute("colspan")).toBe("2");
  });

  it("actions() gets a td.hel-table-actions > div.hel-table-buttons per row", () => {
    const actions = vi.fn((r: R, c: HTMLElement) => void (c.textContent = r.name));
    const t = table(host(), { columns: cols, rows, actions });
    const cells = t.el.querySelectorAll("tbody tr td.hel-table-actions > div.hel-table-buttons");
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("a");
    expect(actions).toHaveBeenCalledTimes(2);
    expect(actions.mock.calls[0][1]).toBe(cells[0]);
  });

  it("rowData sets dataset on tr; onRowClick fires on row click but not on clicks inside .hel-table-actions", () => {
    const onRowClick = vi.fn();
    const t = table(host(), {
      columns: cols,
      rows,
      rowData: (r) => ({ rowName: r.name }),
      onRowClick,
      actions: (_r, c) => void c.appendChild(document.createElement("button")),
    });
    const tr = t.el.querySelector<HTMLElement>("tbody tr")!;
    expect(tr.dataset.rowName).toBe("a");
    tr.querySelector("td")!.click();
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    tr.querySelector("button")!.click();
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("zero rows with empty text shows emptyState(text) instead of the table body and hides thead", () => {
    const t = table(host(), { columns: cols, rows: [], empty: "Nothing here" });
    expect(t.el.querySelector<HTMLElement>("thead")!.hidden).toBe(true);
    expect(t.el.querySelectorAll("tr.hel-table-row").length).toBe(0);
    expect(t.el.querySelector(".hel-empty")!.textContent).toBe("Nothing here");
    t.setRows(rows);
    expect(t.el.querySelector(".hel-empty")).toBeNull();
    expect(t.el.querySelector<HTMLElement>("thead")!.hidden).toBe(false);
  });

  it("setRows replaces the body without recreating the header", () => {
    const t = table(host(), { columns: cols, rows });
    const thead = t.el.querySelector("thead");
    const th = t.el.querySelector("th");
    t.setRows([{ name: "z", n: 9 }]);
    expect(t.el.querySelector("thead")).toBe(thead);
    expect(t.el.querySelector("th")).toBe(th);
    expect(t.el.querySelectorAll("tbody tr.hel-table-row").length).toBe(1);
    t.setGroups([{ title: "G", rows }]);
    expect(t.el.querySelectorAll("tr.hel-table-group").length).toBe(1);
    expect(t.el.querySelectorAll("tr.hel-table-row").length).toBe(2);
  });
});
