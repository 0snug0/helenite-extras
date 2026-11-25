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
}

export interface TableHandle<R> {
  el: HTMLTableElement;
  setRows(rows: R[]): void;
  setGroups(groups: TableGroup<R>[]): void;
}

/** A column's classes on one of its cells: its className, and is-fit when it sizes to its content. */
function classes<R>(cell: HTMLTableCellElement, c: TableColumn<R>): void {
  if (c.className) cell.classList.add(...c.className.split(/\s+/).filter(Boolean));
  if (c.fit) cell.classList.add("is-fit");
}

export function table<R>(parent: HTMLElement, o: TableOptions<R>): TableHandle<R> {
  const doc = parent.ownerDocument;
  const el = doc.createElement("table");
  el.classList.add("hel-table");
  if (o.className) el.classList.add(...o.className.split(/\s+/).filter(Boolean));
  const thead = el.createTHead();
  const headRow = thead.insertRow();
  for (const c of o.columns) {
    const th = doc.createElement("th");
    th.textContent = c.title;
    classes(th, c);
    headRow.appendChild(th);
  }
  if (o.actions) headRow.appendChild(doc.createElement("th")).classList.add("hel-table-actions");
  const tbody = el.createTBody();
  const span = o.columns.length + (o.actions ? 1 : 0);

  const addRow = (row: R): void => {
    const tr = tbody.insertRow();
    tr.classList.add("hel-table-row");
    if (o.rowData) Object.assign(tr.dataset, o.rowData(row));
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
  parent.appendChild(el);
  return {
    el,
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
