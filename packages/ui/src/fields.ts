import { checkList } from "./check-list";
import { choiceList } from "./choice-list";

export type Field =
  | { id: string; kind: "text"; label: string; value?: string; placeholder?: string; secret?: boolean }
  /** `detail` is a second line under the checkbox's label. */
  | { id: string; kind: "checkbox"; label: string; value?: boolean; detail?: string }
  | { id: string; kind: "select"; label: string; value?: string; options: { value: string; label: string }[] }
  /** A list of rows to choose one from (a release picker). */
  | { id: string; kind: "choice"; label?: string; value?: string; options: { value: string; label: string; detail?: string; disabled?: boolean }[] }
  /** Checkboxes to pick any number from; its value is the checked option values, in option order. */
  | { id: string; kind: "multi"; label?: string; value?: string[]; options: { value: string; label: string; detail?: string; disabled?: boolean }[] };

/** What a form resolves to: each field's value by id (text, select and choice: a string; checkbox: a boolean; multi: a string array). */
export type FieldValues = Record<string, string | boolean | string[]>;


let labelCounter = 0;

function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = parent.ownerDocument.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export interface DrawnFields {
  /** Each field's current value by id. */
  values(): FieldValues;
  /** The first control that can take focus, if any. */
  first: HTMLElement | null;
}

/**
 * Draws `fields` as a form's rows (`hel-modal-field`, the classes a form modal styles) and returns how to read them.
 * Frame-safe: the host `form` modal and the vault-app bridge modal both draw their fields with it.
 */
export function drawFields(parent: HTMLElement, fields: Field[]): DrawnFields {
  const read: Record<string, () => FieldValues[string]> = {};
  let first: HTMLElement | null = null;
  for (const f of fields) {
    const row = el(parent, "div", "hel-modal-field");
    row.dataset.field = f.id;
    if (f.kind === "checkbox") {
      const label = el(row, "label", "hel-modal-check");
      const cb = el(label, "input", "");
      cb.type = "checkbox";
      cb.checked = f.value ?? false;
      el(label, "span", "", f.label);
      if (f.detail !== undefined) {
        const detail = el(row, "div", "hel-check-detail", f.detail);
        detail.id = `hel-modal-${++labelCounter}-detail`;
        cb.setAttribute("aria-describedby", detail.id);
      }
      read[f.id] = () => cb.checked;
      first ??= cb;
      continue;
    }
    const label = f.label ? el(row, "label", "hel-modal-label", f.label) : null;
    if (label) label.id = `hel-modal-${++labelCounter}-label`;
    if (f.kind === "text") {
      const input = el(row, "input", "hel-modal-input");
      input.type = f.secret ? "password" : "text";
      input.value = f.value ?? "";
      if (f.placeholder) input.placeholder = f.placeholder;
      if (label) input.setAttribute("aria-labelledby", label.id);
      read[f.id] = () => input.value;
      first ??= input;
    } else if (f.kind === "select") {
      const sel = el(row, "select", "dropdown");
      for (const opt of f.options) {
        const oe = el(sel, "option", "", opt.label);
        oe.value = opt.value;
      }
      sel.value = f.value ?? f.options[0]?.value ?? "";
      if (label) sel.setAttribute("aria-labelledby", label.id);
      read[f.id] = () => sel.value;
      first ??= sel;
    } else if (f.kind === "multi") {
      const list = checkList(row, { options: f.options.map((x) => ({ value: x.value, text: x.label, detail: x.detail, disabled: x.disabled })), value: f.value ?? [] });
      if (label) list.el.setAttribute("aria-labelledby", label.id);
      read[f.id] = () => list.value();
      first ??= list.el.querySelector<HTMLInputElement>("input:not(:disabled)");
    } else {
      let value = f.value ?? "";
      const list = choiceList<string>(row, {
        options: f.options.map((x) => ({ value: x.value, text: x.label, detail: x.detail, disabled: x.disabled })),
        value: f.value,
        onChange: (v) => (value = v),
      });
      list.el.classList.add("hel-modal-choices");
      for (const r of list.el.querySelectorAll(".hel-choice")) r.classList.add("hel-modal-choice");
      read[f.id] = () => value;
    }
  }
  return {
    values() {
      const out: FieldValues = {};
      for (const [id, get] of Object.entries(read)) out[id] = get();
      return out;
    },
    first,
  };
}
