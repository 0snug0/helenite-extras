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
  onEnter?: (v: string) => void;
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

export function textInput(parent: HTMLElement, o: TextInputOptions = {}): HTMLInputElement {
  const el = input(parent, o.secret ? "password" : o.type ?? "text", o.secret ? ["hel-input", "is-secret"] : ["hel-input"], o.label);
  if (o.placeholder !== undefined) el.placeholder = o.placeholder;
  if (o.secret) el.autocomplete = "off";
  el.value = o.value ?? "";
  el.addEventListener("input", () => o.onInput?.(el.value));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) o.onEnter?.(el.value);
  });
  return el;
}

export interface SearchInputOptions {
  placeholder?: string;
  value?: string;
  /** Typing waits this long before `onSearch`, so a large list is not redrawn on every key. Default 120. Enter and the clear button search at once. */
  delayMs?: number;
  onSearch: (q: string) => void;
}

/** A search box in Obsidian's `search-input-container`, with its clear button. Returns the input. */
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
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) search();
  });
  clear.addEventListener("click", () => {
    el.value = "";
    paint();
    search();
    el.focus();
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

/** Obsidian's range slider. `onChange` runs as it moves. */
export function slider(parent: HTMLElement, o: SliderOptions): HTMLInputElement {
  const el = input(parent, "range", ["slider", "hel-slider"], o.label);
  el.min = String(o.min);
  el.max = String(o.max);
  el.step = String(o.step ?? 1);
  el.value = String(o.value);
  el.addEventListener("input", () => o.onChange(Number(el.value)));
  return el;
}
