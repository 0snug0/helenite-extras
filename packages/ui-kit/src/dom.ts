/** Tiny DOM builder. Every string becomes a text node; no markup is ever parsed. */
export type Child = Node | string | number | null | undefined | false | Child[];
export interface Props {
  cls?: string | string[];
  text?: string | number;
  attr?: Record<string, string | number | boolean | null | undefined>;
  on?: Record<string, (e: any) => void>;
  style?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.cls) el.className = Array.isArray(props.cls) ? props.cls.filter(Boolean).join(" ") : props.cls;
  if (props.text != null) el.textContent = String(props.text);
  for (const [k, v] of Object.entries(props.attr ?? {})) {
    if (v == null) continue;
    // aria-* booleans must read "true"/"false"; other booleans are presence attributes.
    if (k.startsWith("aria-")) el.setAttribute(k, String(v));
    else if (v !== false) el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const [k, fn] of Object.entries(props.on ?? {})) el.addEventListener(k, fn);
  for (const [k, v] of Object.entries(props.style ?? {})) el.style.setProperty(k, v);
  append(el, kids);
  return el;
}

export function append(el: Node, kids: Child[]): void {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(typeof k === "object" ? k : document.createTextNode(String(k)));
  }
}

export function clear(el: Node): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let uid = 0;
export const nextId = (p = "hel") => `${p}-${++uid}`;

/** A component handle: root element plus teardown. */
export interface Handle { el: HTMLElement; destroy(): void }

/**
 * Obsidian's DOM helpers (createEl, createDiv, empty, addClass ...), which ported DataviewJS code
 * calls on almost every line. The host injects these into each frame; this copy lets an app or a
 * test install them itself.
 */
export function installObsidianDom(win: Window & typeof globalThis = window as any): void {
  const { Node, HTMLElement, DocumentFragment, document } = win;
  const apply = (el: HTMLElement, o: any) => {
    if (o == null) return el;
    if (typeof o === "string") o = { cls: o };
    if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
    if (o.text != null) el.textContent = String(o.text);
    if (o.title != null) el.title = o.title;
    for (const k of ["href", "type", "value", "placeholder"]) if (o[k] != null) el.setAttribute(k, o[k]);
    for (const [k, v] of Object.entries(o.attr ?? {})) if (v != null && v !== false) el.setAttribute(k, v === true ? "" : String(v));
    return el;
  };
  const createEl = (tag: string, o?: any, cb?: (e: HTMLElement) => void) => {
    const el = apply(document.createElement(tag), o);
    if (o?.parent) o.prepend ? o.parent.prepend(el) : o.parent.append(el);
    cb?.(el);
    return el;
  };
  const methods: Record<string, any> = {
    createEl(this: Node, tag: string, o?: any, cb?: any) { const el = createEl(tag, o); this.appendChild(el); cb?.(el); return el; },
    createDiv(this: any, o?: any, cb?: any) { return this.createEl("div", o, cb); },
    createSpan(this: any, o?: any, cb?: any) { return this.createEl("span", o, cb); },
    empty(this: Node) { clear(this); },
    setText(this: Node, t: unknown) { this.textContent = String(t ?? ""); },
  };
  for (const proto of [Node.prototype, DocumentFragment.prototype]) {
    for (const [k, fn] of Object.entries(methods)) Object.defineProperty(proto, k, { value: fn, configurable: true, writable: true });
  }
  Object.assign(HTMLElement.prototype, {
    addClass(this: HTMLElement, ...c: string[]) { this.classList.add(...c); },
    removeClass(this: HTMLElement, ...c: string[]) { this.classList.remove(...c); },
    toggleClass(this: HTMLElement, c: string, on?: boolean) { this.classList.toggle(c, on); },
    hasClass(this: HTMLElement, c: string) { return this.classList.contains(c); },
    setAttr(this: HTMLElement, k: string, v: string | null) { v == null ? this.removeAttribute(k) : this.setAttribute(k, v); },
    show(this: HTMLElement) { this.style.display = ""; },
    hide(this: HTMLElement) { this.style.display = "none"; },
  });
  Object.assign(win, {
    createEl,
    createDiv: (o?: any, cb?: any) => createEl("div", o, cb),
    createSpan: (o?: any, cb?: any) => createEl("span", o, cb),
    createFragment: (cb?: (f: DocumentFragment) => void) => { const f = document.createDocumentFragment(); cb?.(f); return f; },
  });
}
