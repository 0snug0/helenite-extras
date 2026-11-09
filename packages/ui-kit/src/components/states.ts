import { h, type Child } from "../dom";

export interface StateOpts { title: string; message?: string; icon?: string; actionLabel?: string; onAction?: () => void }

function state(kind: string, role: string, o: StateOpts, extra: Child = null): HTMLElement {
  return h("div", { cls: ["hk-state", `hk-state-${kind}`], attr: { role } },
    o.icon ? h("div", { cls: "hk-state-icon", text: o.icon, attr: { "aria-hidden": true } }) : null,
    h("div", { cls: "hk-state-title", text: o.title }),
    o.message ? h("div", { cls: "hk-state-message", text: o.message }) : null,
    extra,
    o.actionLabel && o.onAction ? h("button", { cls: "hk-btn hk-btn-primary", text: o.actionLabel, attr: { type: "button" }, on: { click: o.onAction } }) : null,
  );
}

export const emptyState = (o: StateOpts) => state("empty", "status", o);
/** Errors are announced to assistive tech. Pass `detail` for a stack or response body, kept collapsed. */
export const errorState = (o: StateOpts & { detail?: string }) =>
  state("error", "alert", o, o.detail ? h("details", { cls: "hk-state-detail" }, h("summary", { text: "Details" }), h("pre", { text: o.detail })) : null);
export const loadingState = (message = "Loading…") => state("loading", "status", { title: message });
