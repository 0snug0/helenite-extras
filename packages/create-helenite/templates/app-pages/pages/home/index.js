// Home page. `export default` is a PageMount: (el, ctx) => cleanup. ctx comes from ../../shell.js:
//   ctx.api        the capability api       ctx.go(page, params)  switch page      ctx.back()  go to the previous page
//   ctx.params     this page's params (read it when you need it)   ctx.onParams(cb)  called when they change; returns unsubscribe
//   ctx.store      api.store, every key prefixed "home:"            ctx.setStatus(service, "ok" | "down" | "unset")
// The page stays mounted (hidden) when the user leaves it, so everything started here is undone in the returned cleanup.
import { button, emptyState, setBridge } from "../../ui-kit.js";

export default async function mount(host, ctx) {
	const { api } = ctx;
	setBridge(api);
	const root = host.createDiv({ cls: "app-scope" });
	root.createEl("h2", { text: "Home" });

	// A setup state, not an error: without the key the page says what to do and keeps the nav working.
	let have = {};
	try { have = (await api.secrets.status()) ?? {}; } catch { have = {}; }
	ctx.setStatus("example", have.EXAMPLE_API_KEY ? "ok" : "unset");
	if (!have.EXAMPLE_API_KEY) {
		const box = root.createDiv({ cls: "app-box" });
		emptyState(box, "The example service is not set up yet. Add its API key to see data here.");
		button(box, { text: "Set the key", variant: "primary", onClick: () => api.secrets.prompt("EXAMPLE_API_KEY").catch(() => {}) });
	}

	const visits = ((await ctx.store.get("visits")) ?? 0) + 1;
	await ctx.store.set("visits", visits);
	root.createEl("p", { text: `This page has been opened ${visits} time${visits === 1 ? "" : "s"}.` });
	button(root, { text: "About this app", onClick: () => ctx.go("about", { from: "home" }) });

	return () => root.remove();
}
