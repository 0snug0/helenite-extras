import { setIconRenderer, type IconRenderer } from "@helenite/ui";

// An app frame has no Obsidian `setIcon`, so ui-kit draws the icons its parts and the standard actions use as inline
// SVG (Lucide shapes, 24x24, stroked with currentColor). Built with createElementNS, no HTML strings.
type Shape = [tag: "path" | "circle" | "line" | "rect", attrs: Record<string, string>];
const p = (d: string): Shape => ["path", { d }];
const c = (cx: number, cy: number, r: number): Shape => ["circle", { cx: String(cx), cy: String(cy), r: String(r) }];
const l = (x1: number, y1: number, x2: number, y2: number): Shape => ["line", { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2) }];

export const KIT_ICONS: Record<string, Shape[]> = {
  "chevron-left": [p("m15 18-6-6 6-6")],
  "chevron-right": [p("m9 18 6-6-6-6")],
  "chevron-down": [p("m6 9 6 6 6-6")],
  x: [p("M18 6 6 18"), p("m6 6 12 12")],
  "rotate-ccw": [p("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"), p("M3 3v5h5")],
  "undo-2": [p("M9 14 4 9l5-5"), p("M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11")],
  home: [p("M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"), p("M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z")],
  settings: [
    p("M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"),
    c(12, 12, 3),
  ],
  power: [p("M12 2v10"), p("M18.4 6.6a9 9 0 1 1-12.77.04")],
  "trash-2": [p("M3 6h18"), p("M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"), p("M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"), l(10, 11, 10, 17), l(14, 11, 14, 17)],
  "external-link": [p("M15 3h6v6"), p("M10 14 21 3"), p("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6")],
  "circle-minus": [c(12, 12, 10), p("M8 12h8")],
  "arrow-up": [p("m5 12 7-7 7 7"), p("M12 19V5")],
  "arrow-down": [p("M12 5v14"), p("m19 12-7 7-7-7")],
  "refresh-cw": [p("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"), p("M21 3v5h-5"), p("M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"), p("M8 16H3v5")],
  "more-horizontal": [c(12, 12, 1), c(19, 12, 1), c(5, 12, 1)],
  check: [p("M20 6 9 17l-5-5")],
  plus: [p("M5 12h14"), p("M12 5v14")],
  search: [c(11, 11, 8), p("m21 21-4.3-4.3")],
  // densityAction's two states
  "align-justify": [l(3, 6, 21, 6), l(3, 12, 21, 12), l(3, 18, 21, 18)],
  "rows-2": [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }], p("M3 12h18")],
};

const SVG = "http://www.w3.org/2000/svg";

/** Draws a known icon as an inline SVG; an unknown name only tags the element (`data-icon`), like the default renderer. */
export const kitIconRenderer: IconRenderer = (el, name) => {
  el.dataset.icon = name;
  const shapes = KIT_ICONS[name];
  if (!shapes) return;
  const doc = el.ownerDocument;
  const svg = doc.createElementNS(SVG, "svg");
  const attrs: Record<string, string> = {
    xmlns: SVG, width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", class: `svg-icon lucide-${name}`, "aria-hidden": "true",
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const [tag, a] of shapes) {
    const shape = doc.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(a)) shape.setAttribute(k, v);
    svg.appendChild(shape);
  }
  el.replaceChildren(svg);
};

setIconRenderer(kitIconRenderer);
