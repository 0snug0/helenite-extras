export interface TabSpec<T extends string> {
  id: T;
  text: string;
  /** A count shown after the text; hidden at 0. */
  badge?: number;
}

export interface TabsOptions<T extends string> {
  tabs: TabSpec<T>[];
  value: T;
  /** Runs when the user picks another tab. The caller draws the panel. */
  onSelect: (id: T) => void;
}

export interface TabsHandle<T extends string> {
  el: HTMLElement;
  /** Marks a tab as chosen without calling `onSelect`. */
  setValue(id: T): void;
  setBadge(id: T, n: number): void;
}

/** WAI-ARIA tabs: roving tabindex, arrow keys, Home and End. */
export function tabs<T extends string>(parent: HTMLElement, o: TabsOptions<T>): TabsHandle<T> {
  const doc = parent.ownerDocument;
  const el = doc.createElement("div");
  el.classList.add("hel-tabs");
  el.setAttribute("role", "tablist");
  let current = o.value;
  const buttons = new Map<T, HTMLButtonElement>();
  const badges = new Map<T, HTMLSpanElement>();

  const paint = (): void => {
    // With no tab chosen (a `value` that is not a tab id), the first tab is the one Tab reaches.
    const focusable = buttons.has(current) ? current : o.tabs[0]?.id;
    for (const [id, b] of buttons) {
      const on = id === current;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = id === focusable ? 0 : -1;
    }
  };
  const setBadge = (id: T, n: number): void => {
    const b = buttons.get(id);
    if (!b) return;
    let span = badges.get(id);
    if (!span) {
      span = doc.createElement("span");
      span.classList.add("hel-tab-badge");
      b.appendChild(span);
      badges.set(id, span);
    }
    span.textContent = String(n);
    span.hidden = n <= 0;
  };
  const select = (id: T, focus: boolean): void => {
    if (!buttons.has(id)) return;
    if (focus) buttons.get(id)!.focus();
    if (id === current) return;
    current = id;
    paint();
    o.onSelect(id);
  };

  for (const t of o.tabs) {
    const b = doc.createElement("button");
    b.type = "button";
    b.classList.add("hel-tab");
    b.setAttribute("role", "tab");
    b.dataset.tab = t.id;
    b.textContent = t.text;
    b.addEventListener("click", () => select(t.id, false));
    buttons.set(t.id, b);
    el.appendChild(b);
    if (t.badge !== undefined) setBadge(t.id, t.badge);
  }
  el.addEventListener("keydown", (e) => {
    const ids = o.tabs.map((t) => t.id);
    const i = ids.indexOf(current);
    const n = ids.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    select(ids[next], true);
  });
  paint();
  parent.appendChild(el);
  return {
    el,
    setValue(id) {
      if (!buttons.has(id)) return;
      current = id;
      paint();
    },
    setBadge,
  };
}
