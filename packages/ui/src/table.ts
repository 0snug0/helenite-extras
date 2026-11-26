import { emptyState } from "./states";

export interface TableColumn<R> {
  key: string;
  title: string;
  /** Return a string to set the cell text, or nothing to fill `td` yourself. */
  cell: (row: R, td: HTMLTableCellElement) => string | void;
  className?: string;
  /**
   * Size the column to its content and never wrap it (class `is-fit`): for short values such as a version, a toggle,
   * a dropdown or a button. Leave it off the column with long text (a name and description), which takes the rest.
   */
  fit?: boolean;
  /**
   * A cell's value state: `default` (faint: the value is the inherited default) or `different` (accent: it differs
   * from the one beside it). Sets `is-default` / `is-different` on the cell; return nothing for a normal cell.
   */
  state?: (row: R) => "default" | "different" | void;
  /** The column's width ("96px"). With `fixed` on the table, columns stay still as rows change. */
  width?: string;
  /** `end` right-aligns the column, with tabular figures: for numbers. */
  align?: "end";
  /** One line, cut with an ellipsis. */
  truncate?: boolean;
  /** The column that shows a row's depth (`rowLevel`): its cells indent. */
  tree?: boolean;
  /** Its header sorts: a click calls `onSort` with the column's key. */
  sortable?: boolean;
  /** Draws the header's content in place of `title` (a brand mark); `headTitle` then names it. */
  head?: (label: HTMLElement) => void;
  /** The header's tooltip and accessible name. */
  headTitle?: string;
}

export interface TableSort {
  key: string;
  dir: "asc" | "desc";
}

export interface TableGroup<R> {
  title: string | ((td: HTMLTableCellElement) => void);
  rows: R[];
}

export interface TableOptions<R> {
  columns: TableColumn<R>[];
  rows?: R[];
  groups?: TableGroup<R>[];
  actions?: (row: R, cell: HTMLElement) => void;
  onRowClick?: (row: R) => void;
  rowData?: (row: R) => Record<string, string>;
  empty?: string;
  className?: string;
  /** The column sorted by, shown by an arrow. The caller sorts the rows. */
  sort?: TableSort;
  /** A sortable header was clicked. The caller chooses the direction, sorts and redraws (or calls `setSort` and `setRows`). */
  onSort?: (key: string) => void;
  /** How deep a row sits under the one above (a tree): 0 (default), 1 or 2. */
  rowLevel?: (row: R) => number;
  /** Dims a row that cannot be used. */
  rowMuted?: (row: R) => boolean;
  /** Columns take their `width`s and stop following the content. */
  fixed?: boolean;
  /** The narrowest the table gets ("900px"); in a narrower pane it scrolls sideways inside `hel-table-scroll`. */
  minWidth?: string;
}

export interface TableHandle<R> {
  el: HTMLTableElement;
  setRows(rows: R[]): void;
  setGroups(groups: TableGroup<R>[]): void;
  /** Moves the sort arrow. */
  setSort(sort: TableSort | undefined): void;
}

/** A column's classes on one of its cells: its className, and is-fit when it sizes to its content. */
function classes<R>(cell: HTMLTableCellElement, c: TableColumn<R>): void {
  if (c.className) cell.classList.add(...c.className.split(/\s+/).filter(Boolean));
  if (c.fit) cell.classList.add("is-fit");
  if (c.align === "end") cell.classList.add("is-end");
  if (c.truncate) cell.classList.add("is-truncate");
  if (c.tree) cell.classList.add("is-tree");
}

export function table<R>(parent: HTMLElement, o: TableOptions<R>): TableHandle<R> {
  const doc = parent.ownerDocument;
  const el = doc.createElement("table");
  el.classList.add("hel-table");
  if (o.className) el.classList.add(...o.className.split(/\s+/).filter(Boolean));
  if (o.fixed) el.classList.add("is-fixed");
  if (o.minWidth) el.style.minWidth = o.minWidth;
  if (o.columns.some((c) => c.width)) {
    const group = el.appendChild(doc.createElement("colgroup"));
    for (const c of o.columns) {
      const col = group.appendChild(doc.createElement("col"));
      col.dataset.col = c.key;
      if (c.width) col.style.width = c.width;
    }
    if (o.actions) group.appendChild(doc.createElement("col"));
  }
  const thead = el.createTHead();
  const headRow = thead.insertRow();
  const sortHeads = new Map<string, HTMLTableCellElement>();
  for (const c of o.columns) {
    const th = doc.createElement("th");
    classes(th, c);
    let label: HTMLElement = th;
    if (c.sortable) {
      const b = th.appendChild(doc.createElement("button"));
      b.type = "button";
      b.classList.add("hel-table-sort");
      th.addEventListener("click", () => o.onSort?.(c.key)); // the whole header, the button's clicks included
      sortHeads.set(c.key, th);
      label = b.appendChild(doc.createElement("span"));
      label.classList.add("hel-table-sort-label");
      if (c.headTitle) b.setAttribute("aria-label", c.headTitle);
    }
    if (c.head) c.head(label);
    else label.textContent = c.title;
    if (c.headTitle) {
      th.title = c.headTitle;
      if (!c.sortable) th.setAttribute("aria-label", c.headTitle);
    }
    headRow.appendChild(th);
  }
  const setSort = (sort: TableSort | undefined): void => {
    for (const [key, th] of sortHeads) {
      if (sort?.key === key) th.setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    }
  };
  setSort(o.sort);
  if (o.actions) headRow.appendChild(doc.createElement("th")).classList.add("hel-table-actions");
  const tbody = el.createTBody();
  const span = o.columns.length + (o.actions ? 1 : 0);

  const addRow = (row: R): void => {
    const tr = tbody.insertRow();
    tr.classList.add("hel-table-row");
    if (o.rowData) Object.assign(tr.dataset, o.rowData(row));
    const level = o.rowLevel?.(row) ?? 0;
    if (level > 0) {
      tr.classList.add("is-nested");
      tr.dataset.level = String(level);
    }
    if (o.rowMuted?.(row)) tr.classList.add("is-muted");
    for (const c of o.columns) {
      const td = tr.insertCell();
      classes(td, c);
      const state = c.state?.(row);
      if (state) td.classList.add(`is-${state}`);
      const text = c.cell(row, td);
      if (typeof text === "string") td.textContent = text;
    }
    if (o.actions) {
      const td = tr.insertCell();
      td.classList.add("hel-table-actions");
      const box = doc.createElement("div");
      box.classList.add("hel-table-buttons");
      td.appendChild(box);
      o.actions(row, box);
    }
    if (o.onRowClick) {
      tr.classList.add("is-clickable");
      tr.addEventListener("click", (e) => {
        if ((e.target as Element).closest(".hel-table-actions")) return;
        o.onRowClick!(row);
      });
    }
  };

  const render = (rows: R[], groups: TableGroup<R>[]): void => {
    tbody.replaceChildren();
    const count = rows.length + groups.reduce((n, g) => n + g.rows.length, 0);
    if (count === 0 && o.empty !== undefined) {
      thead.hidden = true;
      const td = tbody.insertRow().insertCell();
      td.colSpan = span;
      emptyState(td, o.empty);
      return;
    }
    thead.hidden = false;
    rows.forEach(addRow);
    for (const g of groups) {
      const tr = tbody.insertRow();
      tr.classList.add("hel-table-group");
      const td = tr.insertCell();
      td.colSpan = span;
      if (typeof g.title === "string") td.textContent = g.title;
      else g.title(td);
      g.rows.forEach(addRow);
    }
  };

  let rows = o.rows ?? [];
  let groups = o.groups ?? [];
  render(rows, groups);
  if (o.minWidth) {
    const scroll = parent.appendChild(doc.createElement("div"));
    scroll.classList.add("hel-table-scroll");
    scroll.appendChild(el);
  } else parent.appendChild(el);
  return {
    el,
    setSort,
    setRows(r) {
      rows = r;
      groups = [];
      render(rows, groups);
    },
    setGroups(g) {
      groups = g;
      rows = [];
      render(rows, groups);
    },
  };
}
