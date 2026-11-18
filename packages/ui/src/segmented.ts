let labelCounter = 0;

export interface SegmentedOptions<T extends string> {
  label?: string;
  options: { value: T; text: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function segmented<T extends string>(
  parent: HTMLElement,
  o: SegmentedOptions<T>,
): { el: HTMLElement; setValue(v: T): void } {
  const doc = parent.ownerDocument;
  const el = doc.createElement("div");
  el.classList.add("hel-segmented");
  el.setAttribute("role", "group");
  if (o.label) {
    const label = doc.createElement("span");
    label.classList.add("hel-segmented-label");
    label.id = `hel-segmented-label-${++labelCounter}`;
    el.setAttribute("aria-labelledby", label.id);
    label.textContent = o.label;
    el.appendChild(label);
  }
  let current = o.value;
  const buttons = new Map<T, HTMLButtonElement>();
  const paint = (): void => {
    for (const [value, b] of buttons) b.setAttribute("aria-pressed", String(value === current));
  };
  for (const opt of o.options) {
    const b = doc.createElement("button");
    b.type = "button";
    b.classList.add("hel-segment");
    b.textContent = opt.text;
    b.addEventListener("click", () => {
      if (opt.value === current) return;
      current = opt.value;
      paint();
      o.onChange(opt.value);
    });
    buttons.set(opt.value, b);
    el.appendChild(b);
  }
  paint();
  parent.appendChild(el);
  return {
    el,
    setValue(v: T) {
      current = v;
      paint();
    },
  };
}
