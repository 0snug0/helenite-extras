import { h } from "../dom";

export interface FrameDialogOptions {
  /** The accessible name ("Releases for Heat"). */
  label: string;
  /** The backdrop was clicked, or Escape pressed inside the dialog. The caller removes it (or keeps it, while busy). */
  onClose: () => void;
}

export interface FrameDialogHandle {
  /** The `modal-container` on the frame's body. */
  el: HTMLElement;
  /** The dialog box. */
  modal: HTMLElement;
  /** Draw the content here; it scrolls. */
  body: HTMLElement;
  /** Removes the dialog. */
  destroy: () => void;
}

/**
 * A large dialog the app draws itself, for content a host modal cannot show (a table with its own buttons). Lift the frame
 * over the window first (`api.ui.overlay(true)`) and put it back after `destroy`. For yes/no and forms use `confirm`,
 * `prompt`, `choose` and `form`, which the host draws.
 */
export function frameDialog(o: FrameDialogOptions): FrameDialogHandle {
  const body = h("div", { cls: "modal-content" });
  const modal = h("div", { cls: ["modal", "hel-frame-dialog-box"], attr: { role: "dialog", "aria-modal": "true", "aria-label": o.label, tabindex: -1 } }, body);
  const el = h("div", { cls: ["modal-container", "mod-dim", "hel-frame-dialog"] }, h("div", { cls: "modal-bg", on: { click: () => o.onClose() } }), modal);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    o.onClose();
  });
  document.body.append(el);
  modal.focus(); // so Escape reaches the dialog before anything in it is clicked
  return { el, modal, body, destroy: () => el.remove() };
}
