import type { ButtonVariant } from "./button";

export type ActionId =
  | "back" | "close" | "reset" | "useDefault" | "editInHome" | "configure" | "turnOff" | "delete" | "open"
  | "remove" | "add" | "moveUp" | "moveDown" | "reconnect";

/**
 * The standard actions' icon, label and button variant. `ui.action` (the helenite module) and ui-kit's `action` draw
 * from this one table, so a plugin's Delete and an app's Delete look and read the same.
 */
export const STANDARD_ACTIONS: Record<ActionId, { icon: string; label: string; variant: ButtonVariant }> = {
  back: { icon: "chevron-left", label: "Back", variant: "icon" },
  close: { icon: "x", label: "Close", variant: "icon" },
  reset: { icon: "rotate-ccw", label: "Reset", variant: "link" },
  useDefault: { icon: "undo-2", label: "Use Default", variant: "link" },
  editInHome: { icon: "home", label: "Edit in Home", variant: "link" },
  configure: { icon: "settings", label: "Configure", variant: "icon" },
  turnOff: { icon: "power", label: "Turn off", variant: "icon" },
  delete: { icon: "trash-2", label: "Delete", variant: "danger" },
  open: { icon: "external-link", label: "Open", variant: "default" },
  remove: { icon: "circle-minus", label: "Remove", variant: "danger" },
  add: { icon: "plus", label: "Add", variant: "primary" },
  moveUp: { icon: "arrow-up", label: "Move up", variant: "icon" },
  moveDown: { icon: "arrow-down", label: "Move down", variant: "icon" },
  reconnect: { icon: "refresh-cw", label: "Reconnect", variant: "primary" },
};

/** The confirm copy for the actions that ask first. Remove does not claim the thing is gone for good. */
export const ACTION_CONFIRMS: Partial<Record<ActionId, (subject: string) => { title: string; message: string; action: string }>> = {
  delete: (s) => ({ title: `Delete ${s}`, message: `Delete ${s}? This cannot be undone.`, action: "Delete" }),
  remove: (s) => ({ title: `Remove ${s}`, message: `Remove ${s}?`, action: "Remove" }),
};
