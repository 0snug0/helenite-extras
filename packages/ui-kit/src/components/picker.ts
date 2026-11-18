import { h, clear, nextId, type Handle } from "../dom";

export interface PickerOption { value: string; label: string; detail?: string; disabled?: boolean }
export interface PickerHandle extends Handle { value(): string | undefined; setValue(v: string | undefined): void; setOptions(o: PickerOption[]): void }

/**
 * An inline, keyboard-driven listbox: filter box, arrow keys, Enter to choose.
 * Used for release lists and anywhere a `<select>` is too small. For a modal choice, use `choose()`.
 */
export function picker(o: { options: PickerOption[]; value?: string; searchable?: boolean; label?: string; onChange?: (v: string) => void }): PickerHandle {
  let options = o.options;
  let value = o.value;
  let q = "";
  let active = 0;
  const listId = nextId("hel-pick");
  const el = h("div", { cls: "hel-picker" });
  const list = h("div", { cls: "hel-picker-list", attr: { role: "listbox", id: listId, "aria-label": o.label, tabindex: o.searchable ? -1 : 0 } });
  const search = o.searchable
    ? h("input", { cls: "hel-input hel-picker-search", attr: { type: "search", placeholder: "Filter…", "aria-label": "Filter", "aria-controls": listId }, on: { input: (e) => { q = e.target.value; active = 0; draw(); } } })
    : null;
  if (search) el.append(search);
  el.append(list);

  const visible = () => options.filter((x) => !q || `${x.label} ${x.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const choose = (opt: PickerOption) => { if (opt.disabled) return; value = opt.value; draw(); o.onChange?.(opt.value); };

  function draw() {
    clear(list);
    const vis = visible();
    active = Math.min(active, Math.max(0, vis.length - 1));
    vis.forEach((opt, i) => {
      list.append(h("div", {
        cls: ["hel-option", opt.value === value && "is-selected", i === active && "is-active", opt.disabled && "is-disabled"].filter(Boolean) as string[],
        attr: { role: "option", "aria-selected": opt.value === value, "aria-disabled": opt.disabled, "data-value": opt.value },
        on: { click: () => choose(opt) },
      }, h("span", { cls: "hel-option-label", text: opt.label }), opt.detail ? h("span", { cls: "hel-option-detail", text: opt.detail }) : null));
    });
    if (!vis.length) list.append(h("div", { cls: "hel-option-none", text: "No matches" }));
  }
  el.addEventListener("keydown", (e: KeyboardEvent) => {
    const vis = visible();
    if (e.key === "ArrowDown") active = Math.min(vis.length - 1, active + 1);
    else if (e.key === "ArrowUp") active = Math.max(0, active - 1);
    else if (e.key === "Enter") { if (vis[active]) choose(vis[active]); e.preventDefault(); return; }
    else return;
    e.preventDefault(); draw();
  });
  draw();
  return {
    el, value: () => value,
    setValue(v) { value = v; draw(); },
    setOptions(n) { options = n; draw(); },
    destroy: () => clear(el),
  };
}
