// One of Home's panels (tasks, recent notes, calendar): a titled card. Returns its body, which gets `cls`.
import { card } from "../../core/ui-kit.js";

export function panel(root, title, cls) {
	const c = card(root, { title });
	c.el.classList.add("home-panel");
	c.titleEl.classList.add("home-panel-title");
	if (cls) c.body.classList.add(cls);
	return c.body;
}
