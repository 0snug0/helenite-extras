import { renderIcon } from "./icons";

export type ButtonVariant = "default" | "primary" | "danger" | "link" | "icon";

export interface ButtonOptions {
  text?: string;
  icon?: string;
  label?: string;
  variant?: ButtonVariant;
  pressed?: boolean;
  disabled?: boolean;
  /** Makes the button a drag source: a grab cursor, dimmed while dragged. Set the drag's data in your own `dragstart` listener on `el`. */
  draggable?: boolean;
  onClick?: (e: MouseEvent) => unknown;
}

export interface ButtonHandle {
  el: HTMLButtonElement;
  setText(t: string): void;
  setDisabled(d: boolean): void;
  setBusy(b: boolean): void;
  setPressed(p: boolean): void;
}

export function button(parent: HTMLElement, o: ButtonOptions): ButtonHandle {
  const variant = o.variant ?? "default";
  if (variant === "icon" && !o.label) throw new Error("ui.button: an icon button needs a label");
  const el = parent.ownerDocument.createElement("button");
  el.type = "button";
  el.classList.add("hel-button");
  if (variant !== "default") el.classList.add(`is-${variant}`);
  if (variant === "primary") el.classList.add("mod-cta");
  if (variant === "danger") el.classList.add("mod-warning");
  if (variant === "icon") el.classList.add("clickable-icon");
  if (o.label) el.setAttribute("aria-label", o.label);
  if (o.icon) {
    const iconEl = el.ownerDocument.createElement("span");
    iconEl.classList.add("hel-button-icon");
    renderIcon(iconEl, o.icon);
    el.appendChild(iconEl);
  }
  let textEl: HTMLSpanElement | null = null;
  const setText = (t: string): void => {
    if (!textEl) {
      textEl = el.ownerDocument.createElement("span");
      textEl.classList.add("hel-button-text");
      el.appendChild(textEl);
    }
    textEl.textContent = t;
  };
  if (o.text !== undefined) setText(o.text);

  let disabled = o.disabled ?? false;
  let busy = false;
  const sync = (): void => {
    el.disabled = disabled || busy;
  };
  const setDisabled = (d: boolean): void => {
    disabled = d;
    sync();
  };
  const setBusy = (b: boolean): void => {
    busy = b;
    el.classList.toggle("is-busy", b);
    if (b) el.setAttribute("aria-busy", "true");
    else el.removeAttribute("aria-busy");
    sync();
  };
  const setPressed = (p: boolean): void => {
    el.classList.toggle("is-active", p);
    el.setAttribute("aria-pressed", String(p));
  };
  if (o.pressed !== undefined) setPressed(o.pressed);
  sync();
  if (o.draggable) {
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", () => el.classList.add("is-dragging"));
    el.addEventListener("dragend", () => el.classList.remove("is-dragging"));
  }

  el.addEventListener("click", (e) => {
    if (busy || !o.onClick) return;
    const result = o.onClick(e);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      setBusy(true);
      (result as PromiseLike<unknown>).then(
        () => setBusy(false),
        (err) => {
          setBusy(false);
          console.error(err);
        },
      );
    }
  });
  parent.appendChild(el);
  return { el, setText, setDisabled, setBusy, setPressed };
}
