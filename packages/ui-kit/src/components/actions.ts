import { ACTION_CONFIRMS, STANDARD_ACTIONS, button } from "@helenite/ui";
import type { ActionId, ButtonHandle, ButtonVariant, MenuItemSpec } from "@helenite/ui";
import { confirm, menu } from "../bridge";

// The helenite module's ui.action, ui.moreButton and ui.menuButton for app frames: the same signatures without `app`.
// Delete and Remove confirm, and the menus open, through the host bridge (call setBridge first).

export interface ActionOptions {
  onClick: () => unknown;
  label?: string;
  /** `'icon'` draws the action as an icon button, its label the accessible name (a reset beside a hotkey). */
  variant?: "icon";
  /** `delete` and `remove`: what is removed, named in the confirm modal. Required for those two. */
  subject?: string;
  /** `delete` and `remove`: the confirm modal's title ("Delete <subject>"). */
  title?: string;
  /** `delete` and `remove`: the confirm modal's message ("Delete <subject>? This cannot be undone.", "Remove <subject>?"). */
  message?: string;
  /** `delete` and `remove`: the confirm modal's action button ("Delete", "Remove"). */
  confirmText?: string;
}

/** A standard action button (`STANDARD_ACTIONS`): its icon, label and variant. `delete` and `remove` ask in a host modal first. */
export function action(parent: HTMLElement, id: ActionId, o: ActionOptions): ButtonHandle {
  const std = STANDARD_ACTIONS[id];
  const label = o.label ?? std.label;
  const variant = o.variant ?? std.variant;
  let onClick = o.onClick;
  const copy = ACTION_CONFIRMS[id];
  if (copy) {
    const { subject } = o;
    if (!subject) throw new Error(`ui-kit action: ${id} needs a subject`);
    const d = copy(subject);
    onClick = async () => {
      const ok = await confirm({ title: o.title ?? d.title, message: o.message ?? d.message, action: o.confirmText ?? d.action, danger: true });
      if (ok) await o.onClick();
    };
  }
  return button(parent, { variant, icon: std.icon, label, ...(variant === "icon" ? {} : { text: label }), onClick });
}

/** Opens `items` as a host menu under `anchor` (its bottom-left corner, in the frame's coordinates). */
function openUnder(anchor: HTMLElement, items: MenuItemSpec[]): void {
  const r = anchor.getBoundingClientRect();
  menu(items, { x: r.left, y: r.bottom }).catch((err) => console.error(err));
}

/** An icon button that opens a menu built fresh from `items()` under the button. */
export function moreButton(parent: HTMLElement, items: () => MenuItemSpec[], label = "More"): ButtonHandle {
  const handle = button(parent, { variant: "icon", icon: "more-horizontal", label, onClick: () => openUnder(handle.el, items()) });
  return handle;
}

export interface MenuButtonOptions {
  text: string;
  /** Built fresh each time the menu opens. */
  items: () => MenuItemSpec[];
  variant?: ButtonVariant;
}

/** A text button ("Add permission…") with a chevron that opens a menu built fresh from `items()` under it. */
export function menuButton(parent: HTMLElement, o: MenuButtonOptions): ButtonHandle {
  const handle = button(parent, { text: o.text, variant: o.variant, onClick: () => openUnder(handle.el, o.items()) });
  handle.el.classList.add("is-menu");
  handle.el.setAttribute("aria-haspopup", "menu");
  return handle;
}
