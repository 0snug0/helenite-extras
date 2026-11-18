// {{name}}: the app's view. Helenite imports this module in a sandboxed frame and calls its default export with the
// root element and the capability api. See README.md, and docs/dev/vault-apps.md in the Helenite repository.
//
// ui-kit.js is @helenite/ui-kit, bundled by create-helenite. An app frame cannot resolve package names, so an app
// ships its own copy and imports it by relative path.
import { button, card, notice, setBridge, table } from "./ui-kit.js";

export default async function mount(root, api) {
	// Overlays and notices are drawn by the host, through the api. Connect it before calling any of them.
	setBridge(api);

	let clicks = (await api.store.get("clicks")) ?? [];

	const box = card(root, { title: "{{name}}" });
	const list = table(box.body, {
		columns: [{ key: "at", title: "Clicked at", cell: (c) => new Date(c.at).toLocaleTimeString() }],
		rows: clicks,
		empty: "No clicks yet.",
	});
	button(box.body, {
		text: "Add a click",
		variant: "primary",
		onClick: async () => {
			clicks = [{ at: Date.now() }, ...clicks].slice(0, 10);
			await api.store.set("clicks", clicks);
			list.setRows(clicks);
			notice(`${clicks.length} click${clicks.length === 1 ? "" : "s"} saved`);
		},
	});

	// Returned to the host: called when the view closes.
	return () => setBridge(null);
}
