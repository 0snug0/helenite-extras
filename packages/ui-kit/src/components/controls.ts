import { h, nextId, type Child } from "../dom";

export function textInput(o: { value?: string; placeholder?: string; type?: "text" | "search" | "password" | "number"; onInput?: (v: string) => void; onEnter?: (v: string) => void; label?: string }): HTMLInputElement {
  const el = h("input", {
    cls: "hel-input",
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
  const el = h("select", { cls: "hel-select dropdown", attr: { "aria-label": o.label }, on: { change: (e) => o.onChange?.(e.target.value) } },
    o.options.map((x) => h("option", { text: x.label, attr: { value: x.value } })));
  if (o.value != null) el.value = o.value;
  return el;
}

export function checkbox(o: { label: string; checked?: boolean; onChange?: (v: boolean) => void }): HTMLLabelElement {
  const input = h("input", { attr: { type: "checkbox" }, on: { change: (e) => o.onChange?.(e.target.checked) } });
  input.checked = !!o.checked;
  return h("label", { cls: "hel-check" }, input, h("span", { text: o.label }));
}

/** Label + control + optional hint, wired with matching ids. */
export function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = nextId("hel-f");
  control.id ||= id;
  const kids: Child[] = [h("label", { cls: "hel-field-label", text: label, attr: { for: control.id } }), control];
  if (hint) kids.push(h("div", { cls: "hel-field-hint", text: hint }));
  return h("div", { cls: "hel-field" }, kids);
}

export const toolbar = (...kids: Child[]) => h("div", { cls: "hel-toolbar", attr: { role: "toolbar" } }, kids);
