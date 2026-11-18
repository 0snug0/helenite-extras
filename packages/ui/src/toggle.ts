import { joinField } from "./field";

export interface ToggleOptions {
  value: boolean;
  label: string;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}

export interface ToggleHandle {
  el: HTMLElement;
  setValue(v: boolean): void;
  setDisabled(d: boolean): void;
}

/**
 * An on/off switch with its label. The switch is Obsidian's `checkbox-container` (with `is-enabled` when on), so a
 * theme's toggle look applies. Clicking the label or the switch, or Space on it, flips it.
 */
export function toggle(parent: HTMLElement, o: ToggleOptions): ToggleHandle {
  const doc = parent.ownerDocument;
  const el = doc.createElement("label");
  el.classList.add("hel-toggle");
  const box = doc.createElement("div");
  box.classList.add("checkbox-container");
  const input = doc.createElement("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  box.appendChild(input);
  const text = doc.createElement("span");
  text.classList.add("hel-toggle-label");
  text.textContent = o.label;
  el.append(box, text);

  const setValue = (v: boolean): void => {
    input.checked = v;
    box.classList.toggle("is-enabled", v);
  };
  const setDisabled = (d: boolean): void => {
    input.disabled = d;
    box.classList.toggle("is-disabled", d);
    el.classList.toggle("is-disabled", d);
  };
  setValue(o.value);
  setDisabled(o.disabled ?? false);
  input.addEventListener("change", () => {
    box.classList.toggle("is-enabled", input.checked);
    o.onChange?.(input.checked);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    input.click();
  });
  if (parent.classList.contains("hel-field-control")) {
    // The field's hint and error describe the switch; the toggle's own label still names it.
    input.setAttribute("aria-label", o.label);
    joinField(parent, input);
  }
  parent.appendChild(el);
  return { el, setValue, setDisabled };
}
