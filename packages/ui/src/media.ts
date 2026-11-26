import { card, type CardHandle } from "./card";
import { make } from "./states";

export interface ArtworkOptions {
  /** What it shows (a film's title). The accessible name, and the text drawn when there is no image. */
  title: string;
  /** The image's URL. In an app frame it must be in the app's `net` origins. */
  src?: string | null;
  /** The accessible name when it should say more than the title ("Heat on Letterboxd"). */
  label?: string;
  /** The tooltip of a clickable artwork. */
  tooltip?: string;
  /** Makes the artwork a link that calls this instead of navigating. */
  onClick?: (e: MouseEvent) => void;
}

/** A `url()` value safe to set as a background image. */
const cssUrl = (src: string): string => `url("${src.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c))}")`;

/** A poster: artwork at 2:3 (`--hel-art-ratio`), or the title where there is none. */
export function artwork(parent: HTMLElement, o: ArtworkOptions): HTMLElement {
  const el = make(parent, o.onClick ? "a" : "div", ["hel-art"]);
  if (o.onClick) {
    const onClick = o.onClick;
    el.setAttribute("href", "#");
    el.title = o.tooltip ?? o.title;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
  }
  // A background image, not an <img>: a theme that zooms images on click leaves it alone.
  const image = make(el, "div", ["hel-art-image"]);
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", o.label ?? o.title);
  if (o.src) image.style.backgroundImage = cssUrl(o.src);
  else {
    el.classList.add("is-missing");
    image.textContent = o.title;
  }
  return el;
}

export interface MediaGridOptions {
  /** `grid` (default) fills the width with equal columns; `strip` is one row that scrolls sideways. */
  layout?: "grid" | "strip";
  /** The narrowest a column gets, in px. Default 150. */
  minWidth?: number;
}

/** The container for media cards. Returns it; draw `mediaCard`s into it. */
export function mediaGrid(parent: HTMLElement, o: MediaGridOptions = {}): HTMLElement {
  const el = make(parent, "div", ["hel-media-grid", `is-${o.layout ?? "grid"}`]);
  if (o.minWidth !== undefined) el.style.setProperty("--hel-media-min", `${o.minWidth}px`);
  return el;
}

export interface MediaCardOptions {
  art: ArtworkOptions;
  /** Draws the title under the artwork, on at most two lines (it always takes two, so cards line up). */
  title?: string;
  /** A faint description under the title, cut after two lines. */
  detail?: string;
  /**
   * `tile` (default): artwork on top, centred text, the footer pinned to the bottom. `row`: a small artwork beside the
   * text, the footer at the end (a search result).
   */
  layout?: "tile" | "row";
  /** No ring and no padding: artwork and text on the page. */
  plain?: boolean;
  /** Outlined: the card something is open for. */
  selected?: boolean;
  /** A strong ring: the card a link led to. */
  focused?: boolean;
}

export interface MediaCardHandle extends CardHandle {
  art: HTMLElement;
}

/** A card led by artwork. Draw text into `body` and buttons into `footer`. */
export function mediaCard(parent: HTMLElement, o: MediaCardOptions): MediaCardHandle {
  const c = card(parent, { tone: o.selected ? "accent" : "default", compact: true });
  c.el.classList.add("hel-media-card", `is-${o.layout ?? "tile"}`);
  if (o.plain) c.el.classList.add("is-plain");
  if (o.focused) c.el.classList.add("is-focused");
  const art = artwork(c.el, o.art);
  c.el.insertBefore(art, c.body);
  if (o.title !== undefined) make(c.body, "div", ["hel-media-title"], o.title).title = o.title;
  if (o.detail) make(c.body, "div", ["hel-media-detail"], o.detail).title = o.detail;
  return { ...c, art };
}
