let fieldCounter = 0;

export interface FieldOptions {
  label: string;
  hint?: string;
  /** Label and control on one row. */
  inline?: boolean;
}

export interface FieldHandle {
  el: HTMLElement;
  /** Draw the control into this. An input part drawn here is named by the label and described by the hint. */
  control: HTMLElement;
  /** Shows a message under the control (and marks it invalid); `null` clears it. */
  setError(msg: string | null): void;
  /** Replaces the hint's text (a field made without `hint` gets one); an empty string leaves the line empty. */
  setHint(text: string): void;
}

/** A label, a slot for one control, an optional hint and an error line. */
export function field(parent: HTMLElement, o: FieldOptions): FieldHandle {
  const doc = parent.ownerDocument;
  const id = `hel-field-${++fieldCounter}`;
  const el = doc.createElement("div");
  el.classList.add("hel-field");
  if (o.inline) el.classList.add("is-inline");
  const label = doc.createElement("label");
  label.classList.add("hel-field-label");
  label.id = `${id}-label`;
  label.textContent = o.label;
  const control = doc.createElement("div");
  control.classList.add("hel-field-control");
  control.dataset.labelledby = label.id;
  el.append(label, control);
  const described: string[] = [];
  let hint: HTMLElement | null = null;
  const makeHint = (text: string): HTMLElement => {
    const h = doc.createElement("div");
    h.classList.add("hel-field-hint");
    h.id = `${id}-hint`;
    h.textContent = text;
    return h;
  };
  if (o.hint !== undefined) {
    hint = makeHint(o.hint);
    el.appendChild(hint);
    described.push(hint.id);
  }
  const error = doc.createElement("div");
  error.classList.add("hel-field-error");
  error.id = `${id}-error`;
  error.setAttribute("role", "alert");
  error.hidden = true;
  el.appendChild(error);
  described.push(error.id);
  control.dataset.describedby = described.join(" ");
  parent.appendChild(el);
  return {
    el,
    control,
    setHint(text) {
      if (hint) return void (hint.textContent = text);
      hint = makeHint(text);
      el.insertBefore(hint, error);
      control.dataset.describedby = `${hint.id} ${error.id}`;
      for (const c of control.querySelectorAll("[aria-describedby]")) c.setAttribute("aria-describedby", control.dataset.describedby);
    },
    setError(msg) {
      error.hidden = msg === null;
      error.textContent = msg ?? "";
      el.classList.toggle("is-invalid", msg !== null);
      for (const c of control.querySelectorAll("input, select, textarea")) {
        if (msg === null) c.removeAttribute("aria-invalid");
        else c.setAttribute("aria-invalid", "true");
      }
    },
  };
}

/**
 * Called by the input parts on the element they made. When `parent` is a field's control slot, the field's label
 * names the control (unless it has its own `aria-label`) and its hint and error line describe it.
 */
export function joinField(parent: HTMLElement, control: HTMLElement): void {
  const labelledby = parent.dataset.labelledby;
  if (!parent.classList.contains("hel-field-control") || !labelledby) return;
  if (!control.hasAttribute("aria-label")) control.setAttribute("aria-labelledby", labelledby);
  if (parent.dataset.describedby) control.setAttribute("aria-describedby", parent.dataset.describedby);
  const label = parent.parentElement?.querySelector<HTMLLabelElement>(":scope > .hel-field-label");
  if (label && !label.htmlFor) {
    control.id ||= `${labelledby}-control`;
    label.htmlFor = control.id;
  }
}
