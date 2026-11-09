import { h, clear, type Child, type Handle } from "../dom";

export type SortType = "string" | "number" | "date";
export interface Column<R> {
  key: string;
  label: string;
  /** Enables sorting. Values come from `value(row)` (default `row[key]`). */
  sort?: SortType | ((a: R, b: R) => number);
  value?: (row: R) => unknown;
  render?: (row: R) => Child;
  align?: "left" | "right" | "center";
  width?: string;
}
export interface SortState { key: string; dir: "asc" | "desc" }
export interface TableOpts<R> {
  columns: Column<R>[];
  rows: R[];
  rowKey?: (row: R, i: number) => string;
  sort?: SortState;
  onSort?: (s: SortState) => void;
  onRowClick?: (row: R) => void;
  empty?: Child;
  caption?: string;
}
export interface TableHandle<R> extends Handle {
  setRows(rows: R[]): void;
  setSort(s: SortState): void;
  getSort(): SortState | undefined;
  sorted(): R[];
}

const blank = (v: unknown) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

function compare(type: SortType, a: unknown, b: unknown): number {
  if (type === "number") return Number(a) - Number(b);
  if (type === "date") return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Stable sort; empty values always go last, whichever direction. */
export function sortRows<R>(rows: R[], col: Column<R>, dir: "asc" | "desc"): R[] {
  if (!col.sort) return rows.slice();
  const get = col.value ?? ((r: R) => (r as any)[col.key]);
  const cmp = typeof col.sort === "function" ? col.sort : (a: R, b: R) => compare(col.sort as SortType, get(a), get(b));
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      if (typeof col.sort !== "function") {
        const bx = blank(get(x.r)), by = blank(get(y.r));
        if (bx || by) return bx && by ? x.i - y.i : bx ? 1 : -1;
      }
      return cmp(x.r, y.r) * sign || x.i - y.i;
    })
    .map((x) => x.r);
}

export function sortableTable<R>(o: TableOpts<R>): TableHandle<R> {
  let rows = o.rows;
  let sort = o.sort;
  const table = h("table", { cls: "hk-table" });
  const wrap = h("div", { cls: "hk-table-wrap" }, table);
  if (o.caption) table.append(h("caption", { cls: "hk-sr", text: o.caption }));

  const view = () => {
    const col = o.columns.find((c) => c.key === sort?.key);
    return col && sort ? sortRows(rows, col, sort.dir) : rows.slice();
  };

  const draw = () => {
    clear(table);
    if (o.caption) table.append(h("caption", { cls: "hk-sr", text: o.caption }));
    const head = h("tr");
    for (const c of o.columns) {
      const active = sort?.key === c.key;
      const th = h("th", {
        cls: ["hk-th", c.align && `hk-${c.align}`, c.sort && "is-sortable"].filter(Boolean) as string[],
        attr: { scope: "col", "aria-sort": c.sort ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : null },
        style: c.width ? { width: c.width } : {},
      });
      if (c.sort) {
        th.append(h("button", {
          cls: "hk-th-btn", attr: { type: "button" },
          on: { click: () => setSort({ key: c.key, dir: active && sort!.dir === "asc" ? "desc" : "asc" }, true) },
        }, c.label, h("span", { cls: "hk-sort-mark", text: active ? (sort!.dir === "asc" ? "▲" : "▼") : "", attr: { "aria-hidden": true } })));
      } else th.append(c.label);
      head.append(th);
    }
    table.append(h("thead", {}, head));
    const body = h("tbody");
    const list = view();
    list.forEach((r, i) => {
      const tr = h("tr", {
        cls: o.onRowClick ? "is-clickable" : "",
        attr: { "data-key": o.rowKey?.(r, i), tabindex: o.onRowClick ? 0 : null },
        on: o.onRowClick ? {
          click: (e) => { if (!(e.target as HTMLElement).closest("button,a,input,select")) o.onRowClick!(r); },
          keydown: (e) => { if (e.key === "Enter" && e.target === tr) o.onRowClick!(r); },
        } : {},
      });
      for (const c of o.columns) {
        const v = c.render ? c.render(r) : ((c.value ?? ((x: R) => (x as any)[c.key]))(r) as Child);
        tr.append(h("td", { cls: c.align ? `hk-${c.align}` : "" }, blank(v) ? "" : v as Child));
      }
      body.append(tr);
    });
    table.append(body);
    if (!list.length && o.empty != null) {
      body.append(h("tr", { cls: "hk-table-empty" }, h("td", { attr: { colspan: o.columns.length } }, o.empty)));
    }
  };

  function setSort(s: SortState, notify = false) {
    sort = s; draw();
    if (notify) o.onSort?.(s);
  }

  draw();
  return {
    el: wrap,
    setRows(r) { rows = r; draw(); },
    setSort: (s) => setSort(s),
    getSort: () => sort,
    sorted: view,
    destroy: () => clear(wrap),
  };
}
