import { joinField } from "./field";

export interface TextInputOptions {
  value?: string;
  placeholder?: string;
  /** A password-style input whose text is hidden. */
  secret?: boolean;
  type?: "text" | "number";
  /** The accessible name, when there is no visible label (a field's label names it otherwise). */
  label?: string;
  onInput?: (v: string) => void;
  /** Called on Enter. In a multiline box Enter starts a new line and this is not called. */
  onEnter?: (v: string) => void;
  /** A `<textarea>` for an answer of several lines, `rows` high (default 3). */
  multiline?: boolean;
  rows?: number;
  /** With `multiline`: the box holds source code. Monospace, never wrapped, no spelling or autocapitalisation help. */
  code?: boolean;
}

function input(parent: HTMLElement, type: string, cls: string[], label?: string): HTMLInputElement {
  const el = parent.ownerDocument.createElement("input");
  el.type = type;
  el.classList.add(...cls);
  if (label) el.setAttribute("aria-label", label);
  joinField(parent, el);
  parent.appendChild(el);
  return el;
}

/** A text box. With `multiline: true` it is a `<textarea>` (`hel-input is-multiline`). */
export function textInput(parent: HTMLElement, o: TextInputOptions & { multiline: true }): HTMLTextAreaElement;
export function textInput(parent: HTMLElement, o?: TextInputOptions & { multiline?: false }): HTMLInputElement;
export function textInput(parent: HTMLElement, o: TextInputOptions = {}): HTMLInputElement | HTMLTextAreaElement {
  let el: HTMLInputElement | HTMLTextAreaElement;
  if (o.multiline) {
    el = parent.ownerDocument.createElement("textarea");
    el.classList.add("hel-input", "is-multiline");
    el.setAttribute("rows", String(o.rows ?? 3));
    if (o.label) el.setAttribute("aria-label", o.label);
    if (o.code) {
      el.classList.add("is-code");
      for (const [k, v] of [["wrap", "off"], ["spellcheck", "false"], ["autocapitalize", "off"], ["autocomplete", "off"], ["autocorrect", "off"]]) el.setAttribute(k, v);
    }
    joinField(parent, el);
    parent.appendChild(el);
  } else {
    el = input(parent, o.secret ? "password" : o.type ?? "text", o.secret ? ["hel-input", "is-secret"] : ["hel-input"], o.label);
    if (o.secret) el.autocomplete = "off";
  }
  if (o.placeholder !== undefined) el.placeholder = o.placeholder;
  el.value = o.value ?? "";
  const box = el;
  box.addEventListener("input", () => o.onInput?.(box.value));
  // Not instanceof: a frame's elements come from another realm.
  if (!o.multiline) {
    (box as HTMLInputElement).addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) o.onEnter?.(box.value);
    });
  }
  return box;
}

export interface SearchInputOptions {
  placeholder?: string;
  value?: string;
  /** Typing waits this long before `onSearch`, so a large list is not redrawn on every key. Default 120. Enter and the clear button search at once. */
  delayMs?: number;
  onSearch: (q: string) => void;
}

/** A search box in Obsidian's `search-input-container`, with its clear button. Escape clears it. Returns the input. */
export function searchInput(parent: HTMLElement, o: SearchInputOptions): HTMLInputElement {
  const doc = parent.ownerDocument;
  const wrap = doc.createElement("div");
  wrap.classList.add("search-input-container");
  parent.appendChild(wrap);
  const placeholder = o.placeholder ?? "Search";
  const el = input(wrap, "search", ["hel-input", "hel-search"]);
  if (!parent.classList.contains("hel-field-control")) el.setAttribute("aria-label", placeholder);
  joinField(parent, el);
  el.placeholder = placeholder;
  el.enterKeyHint = "search";
  el.spellcheck = false;
  el.value = o.value ?? "";
  const clear = doc.createElement("div");
  clear.classList.add("search-input-clear-button");
  clear.setAttribute("aria-label", "Clear search");
  clear.setAttribute("role", "button");
  clear.tabIndex = 0;
  wrap.appendChild(clear);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = (): void => {
    clearTimeout(timer);
    o.onSearch(el.value);
  };
  const paint = (): void => {
    clear.style.display = el.value ? "" : "none";
  };
  paint();
  el.addEventListener("input", () => {
    paint();
    clearTimeout(timer);
    timer = setTimeout(search, o.delayMs ?? 120);
  });
  const reset = (): void => {
    el.value = "";
    paint();
    search();
    el.focus();
  };
  el.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter") search();
    else if (e.key === "Escape" && el.value) {
      // A non-empty box takes Escape for itself; an empty one lets it reach the modal or view.
      e.preventDefault();
      e.stopPropagation();
      reset();
    }
  });
  clear.addEventListener("click", reset);
  clear.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    reset();
  });
  return el;
}

export interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  value: number;
  label: string;
  onChange: (v: number) => void;
}

/** Sets `--hel-fill` (0% to 100%) so the track can show the part before the thumb filled. */
function setFill(el: HTMLInputElement): void {
  const min = Number(el.min);
  const span = Number(el.max) - min;
  const pct = span > 0 ? ((Number(el.value) - min) / span) * 100 : 0;
  el.style.setProperty("--hel-fill", `${Math.min(100, Math.max(0, pct))}%`);
}

/** Obsidian's range slider, its track filled up to the thumb. `onChange` runs as it moves. */
export function slider(parent: HTMLElement, o: SliderOptions): HTMLInputElement {
  const el = input(parent, "range", ["slider", "hel-slider"], o.label);
  el.min = String(o.min);
  el.max = String(o.max);
  el.step = String(o.step ?? 1);
  el.value = String(o.value);
  setFill(el);
  el.addEventListener("input", () => {
    setFill(el);
    o.onChange(Number(el.value));
  });
  return el;
}
