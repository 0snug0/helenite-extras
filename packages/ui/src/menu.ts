export type MenuItemSpec =
  | { title: string; icon?: string; danger?: boolean; disabled?: boolean; onClick: () => unknown }
  | "separator";

/** Opens a context menu at a mouse event or a point (client coordinates in the parent's document). */
export type MenuRenderer = (items: MenuItemSpec[], at: MouseEvent | { x: number; y: number }) => void;

let renderer: MenuRenderer | null = null;

/** Host runtimes install the menu a part opens (the helenite module's `ui.menu`, or ui-kit's bridge menu). */
export function setMenuRenderer(fn: MenuRenderer | null): void {
  renderer = fn;
}

/** Opens a menu through the installed renderer. Without one (a bare test or preview), nothing opens. */
export function openMenu(items: MenuItemSpec[], at: MouseEvent | { x: number; y: number }): void {
  renderer?.(items, at);
}
