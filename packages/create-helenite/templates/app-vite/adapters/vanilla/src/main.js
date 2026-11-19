import "./style.css";
import { defineApp, watchNotes } from "./helenite/index.js";

export default defineApp((root) => {
	const doc = root.ownerDocument;
	const make = (tag, props) => Object.assign(doc.createElement(tag), props);
	const app = make("div", { className: "app" });
	const ul = make("ul");
	app.append(make("h1", { textContent: {{nameJs}} }), make("p", { className: "muted", textContent: "The ten notes you edited last." }), ul);
	root.appendChild(app);
	const stop = watchNotes({ from: "**/*.md", sort: (a, b) => b.mtime - a.mtime, limit: 10 }, ({ notes }) => {
		ul.replaceChildren(...notes.map((n) => make("li", { textContent: n.basename })));
	});
	return () => { stop(); app.remove(); };
});
