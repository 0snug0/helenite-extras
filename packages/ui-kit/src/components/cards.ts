import { h, clear, type Handle } from "../dom";

export interface CardItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Image URL. Must be in the app's `net` origins (the frame's CSP `img-src`). */
  image?: string;
  badges?: string[];
  meta?: string;
}

function poster(item: CardItem, cls: string): HTMLElement {
  const box = h("div", { cls });
  const fallback = () => { box.classList.add("is-fallback"); clear(box); box.append(h("span", { cls: "hk-poster-initial", text: item.title.slice(0, 1).toUpperCase() })); };
  if (!item.image) { fallback(); return box; }
  const img = h("img", { attr: { src: item.image, alt: "", loading: "lazy", draggable: false }, on: { error: fallback } });
  box.append(img);
  return box;
}

export interface CardGridOpts {
  items: CardItem[];
  /** Minimum card width in px (default 150). */
  minWidth?: number;
  onSelect?: (item: CardItem) => void;
  /** Adds a ✕ button to each card. */
  onRemove?: (item: CardItem) => void;
  empty?: Node;
}
export interface ListHandle extends Handle { setItems(items: CardItem[]): void }

export function cardGrid(o: CardGridOpts): ListHandle {
  const el = h("div", { cls: "hk-cards", attr: { role: "list" }, style: { "--hk-card-min": `${o.minWidth ?? 150}px` } });
  let items = o.items;
  const draw = () => {
    clear(el);
    if (!items.length && o.empty) { el.append(o.empty); return; }
    for (const it of items) {
      const card = h("div", { cls: "hk-card", attr: { role: "listitem", "data-id": it.id } },
        h("button", {
          cls: "hk-card-main", attr: { type: "button", "aria-label": it.title },
          on: { click: () => o.onSelect?.(it) },
        },
          poster(it, "hk-card-poster"),
          h("div", { cls: "hk-card-body" },
            h("div", { cls: "hk-card-title", text: it.title }),
            it.subtitle ? h("div", { cls: "hk-card-sub", text: it.subtitle }) : null,
            it.meta ? h("div", { cls: "hk-card-meta", text: it.meta }) : null,
            it.badges?.length ? h("div", { cls: "hk-card-badges" }, it.badges.map((b) => h("span", { cls: "hk-badge", text: b }))) : null,
          )),
        o.onRemove ? h("button", { cls: "hk-card-remove", text: "✕", attr: { type: "button", "aria-label": `Remove ${it.title}`, title: "Remove" }, on: { click: () => o.onRemove!(it) } }) : null,
      );
      el.append(card);
    }
  };
  draw();
  return { el, setItems(n) { items = n; draw(); }, destroy: () => clear(el) };
}

export interface PosterRowOpts { items: CardItem[]; title?: string; onSelect?: (item: CardItem) => void }

/** A horizontally scrolling row of posters (recommendations, "up next"). */
export function posterRow(o: PosterRowOpts): ListHandle {
  const el = h("section", { cls: "hk-poster-row" });
  let items = o.items;
  const draw = () => {
    clear(el);
    if (o.title) el.append(h("h3", { cls: "hk-row-title", text: o.title }));
    const track = h("div", { cls: "hk-row-track", attr: { role: "list", tabindex: 0 } });
    for (const it of items) {
      track.append(h("button", { cls: "hk-poster-item", attr: { type: "button", role: "listitem", "data-id": it.id, "aria-label": it.title }, on: { click: () => o.onSelect?.(it) } },
        poster(it, "hk-poster"),
        h("div", { cls: "hk-poster-title", text: it.title }),
        it.subtitle ? h("div", { cls: "hk-poster-sub", text: it.subtitle }) : null));
    }
    el.append(track);
  };
  draw();
  return { el, setItems(n) { items = n; draw(); }, destroy: () => clear(el) };
}
