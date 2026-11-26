import { make } from "./states";

/** What a swatch previews, each by the CSS property its value goes into. */
const PROPERTY = {
  color: "background",
  radius: "border-radius",
  shadow: "box-shadow",
  size: "width",
  "font-family": "font-family",
  "font-size": "font-size",
  "font-weight": "font-weight",
} as const;

export type SwatchKind = keyof typeof PROPERTY;

export interface SwatchOptions {
  /** What the value is: a colour (or gradient), a corner radius, a box shadow, a length, or one of three font values. */
  kind: SwatchKind;
  /** The CSS value on show, written out ("8px", "rebeccapurple") or a variable ("var(--radius-m)"). One CSS cannot read draws nothing. */
  value: string;
  /** What it previews (a token's name). The swatch's accessible name. */
  label: string;
  /** The tooltip; the value by default. */
  title?: string;
}

/** A small preview of one CSS value, for a token table or a theme picker. */
export function swatch(parent: HTMLElement, o: SwatchOptions): HTMLElement {
  const el = make(parent, "span", ["hel-swatch", `is-${o.kind}`]);
  el.title = o.title ?? o.value;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", o.label);
  const fill = make(el, "span", ["hel-swatch-fill"], o.kind.startsWith("font-") ? "Aa" : undefined);
  fill.style.setProperty(PROPERTY[o.kind], o.value);
  return el;
}
