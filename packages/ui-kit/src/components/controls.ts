import { h, nextId, type Child } from "../dom";

export interface ButtonOpts { label: string; onClick?: (e: MouseEvent) => void; primary?: boolean; danger?: boolean; disabled?: boolean; title?: string }
export function button(o: ButtonOpts): HTMLButtonElement {
  return h("button", {
    cls: ["hk-btn", o.primary && "hk-btn-primary", o.danger && "hk-btn-danger"].filter(Boolean) as string[],
    text: o.label,
    attr: { type: "button", disabled: o.disabled, title: o.title },
    on: o.onClick ? { click: o.onClick } : {},
  });
}

export function textInput(o: { value?: string; placeholder?: string; type?: "text" | "search" | "password" | "number"; onInput?: (v: string) => void; onEnter?: (v: string) => void; label?: string }): HTMLInputElement {
  const el = h("input", {
    cls: "hk-input",
    attr: { type: o.type ?? "text", placeholder: o.placeholder, "aria-label": o.label },
    on: {
      input: (e) => o.onInput?.(e.target.value),
      keydown: (e) => { if (e.key === "Enter") o.onEnter?.(e.target.value); },
    },
  });
  el.value = o.value ?? "";
  return el;
}

/** Search box with a debounce, so typing does not re-render a large table on every key. */
export function searchInput(o: { placeholder?: string; delayMs?: number; onSearch: (q: string) => void }): HTMLInputElement {
  let t: ReturnType<typeof setTimeout> | undefined;
  return textInput({ type: "search", placeholder: o.placeholder ?? "Search", label: o.placeholder ?? "Search", onInput: (v) => { clearTimeout(t); t = setTimeout(() => o.onSearch(v), o.delayMs ?? 120); }, onEnter: (v) => { clearTimeout(t); o.onSearch(v); } });
}

export function select(o: { options: { value: string; label: string }[]; value?: string; onChange?: (v: string) => void; label?: string }): HTMLSelectElement {
  const el = h("select", { cls: "hk-select dropdown", attr: { "aria-label": o.label }, on: { change: (e) => o.onChange?.(e.target.value) } },
    o.options.map((x) => h("option", { text: x.label, attr: { value: x.value } })));
  if (o.value != null) el.value = o.value;
  return el;
}

export function checkbox(o: { label: string; checked?: boolean; onChange?: (v: boolean) => void }): HTMLLabelElement {
  const input = h("input", { attr: { type: "checkbox" }, on: { change: (e) => o.onChange?.(e.target.checked) } });
  input.checked = !!o.checked;
  return h("label", { cls: "hk-check" }, input, h("span", { text: o.label }));
}

export function toggle(o: { label: string; on?: boolean; onChange?: (v: boolean) => void }): HTMLButtonElement {
  const el = h("button", { cls: "hk-toggle", text: o.label, attr: { type: "button", role: "switch", "aria-checked": !!o.on } });
  el.addEventListener("click", () => {
    const next = el.getAttribute("aria-checked") !== "true";
    el.setAttribute("aria-checked", String(next));
    o.onChange?.(next);
  });
  return el;
}

/** Label + control + optional hint, wired with matching ids. */
export function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = nextId("hk-f");
  control.id ||= id;
  const kids: Child[] = [h("label", { cls: "hk-field-label", text: label, attr: { for: control.id } }), control];
  if (hint) kids.push(h("div", { cls: "hk-field-hint", text: hint }));
  return h("div", { cls: "hk-field" }, kids);
}

export const toolbar = (...kids: Child[]) => h("div", { cls: "hk-toolbar", attr: { role: "toolbar" } }, kids);
export const badge = (text: string, kind: "default" | "good" | "warn" | "bad" = "default") => h("span", { cls: ["hk-badge", `hk-badge-${kind}`], text });
