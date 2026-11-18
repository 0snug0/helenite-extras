export type IconRenderer = (el: HTMLElement, name: string) => void;

const defaultRenderer: IconRenderer = (el, name) => {
  el.dataset.icon = name;
};

let renderer: IconRenderer = defaultRenderer;

/** Host runtimes install a real icon renderer; the default only tags the element. */
export function setIconRenderer(fn: IconRenderer): void {
  renderer = fn;
}

export function renderIcon(el: HTMLElement, name: string): void {
  renderer(el, name);
}
