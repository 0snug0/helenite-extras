import { h, clear, type Handle } from "../dom";

export interface TabSpec { id: string; label: string; badge?: string | number }
export interface TabsHandle extends Handle { select(id: string): void; value(): string }

/** WAI-ARIA tabs: roving tabindex, arrow/Home/End keys. The caller renders the panel in `onSelect`. */
export function tabs(o: { tabs: TabSpec[]; value?: string; onSelect?: (id: string) => void }): TabsHandle {
  let cur = o.value ?? o.tabs[0]?.id ?? "";
  const el = h("div", { cls: "hk-tabs", attr: { role: "tablist" } });
  const draw = () => {
    clear(el);
    o.tabs.forEach((t) => {
      const sel = t.id === cur;
      el.append(h("button", {
        cls: ["hk-tab", sel && "is-active"].filter(Boolean) as string[],
        attr: { type: "button", role: "tab", "aria-selected": sel, tabindex: sel ? 0 : -1, "data-tab": t.id },
        on: { click: () => select(t.id) },
      }, t.label, t.badge != null ? h("span", { cls: "hk-tab-badge", text: t.badge }) : null));
    });
  };
  const select = (id: string, focus = false) => {
    if (!o.tabs.some((t) => t.id === id)) return;
    const changed = id !== cur;
    cur = id; draw();
    if (focus) (el.querySelector(`[data-tab="${id}"]`) as HTMLElement | null)?.focus();
    if (changed) o.onSelect?.(id);
  };
  el.addEventListener("keydown", (e: KeyboardEvent) => {
    const i = o.tabs.findIndex((t) => t.id === cur);
    const n = o.tabs.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    select(o.tabs[next].id, true);
  });
  draw();
  return { el, select: (id) => select(id), value: () => cur, destroy: () => clear(el) };
}
