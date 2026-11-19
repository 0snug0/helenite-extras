// About page: shows how pages talk to each other. See ../home/index.js for what ctx holds.
//   ctx.go("home")                navigate, optionally with params: ctx.go("about", { from: "home" })
//   ctx.params                    the params of the current visit, e.g. { from: "home" }; {} when there are none
//   ctx.onParams(cb)              the page is kept alive while hidden, so a second visit does NOT remount it:
//                                 it calls cb(params) instead. Listen here to react to a new deep link.
// A deep link (a note's `helenite-app <id> page=about from=note`, openApp(id, { params })) arrives the same way, so a page must
// treat its params as read-only: show or focus something, never change data because a link says so.
import { button } from "../../ui-kit.js";

export default async function mount(host, ctx) {
	const root = host.createDiv({ cls: "app-scope" });
	root.createEl("h2", { text: "About" });
	const from = root.createEl("p");
	const draw = (params) => { from.textContent = params.from ? `You came here from ${params.from}.` : "You opened this page directly."; };
	draw(ctx.params);
	const off = ctx.onParams(draw);
	const actions = root.createDiv({ cls: "app-actions" });
	button(actions, { text: "Back", onClick: () => ctx.back() });
	button(actions, { text: "Home", variant: "primary", onClick: () => ctx.go("home") });
	return () => { off(); root.remove(); };
}
