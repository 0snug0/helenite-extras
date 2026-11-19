import "./style.css";
import { defineApp, watchNotes } from "./helenite/index.js";
import { Badge, Button, Card, EmptyState, Grid, List, ListItem, Muted, Row, Stack, Stat, Title } from "./ds/index.js";

export default defineApp((root) => {
	const body = Stack([]);
	const app = document.createElement("div");
	app.className = "app";
	app.append(body);
	root.appendChild(app);
	let refresh = () => {};
	const header = Row([Title({{nameJs}}), Button("Refresh", { variant: "primary", onClick: () => refresh() })], { between: true });
	const stop = watchNotes({ from: "**/*.md", sort: (a, b) => b.mtime - a.mtime, limit: 10 }, (s) => {
		refresh = s.refresh;
		const parts = [header, Grid([Card(Stat("Notes shown", s.notes.length)), Card(Stat("Latest", s.notes[0]?.basename ?? "-"))], { min: "10rem" }), Muted("The ten notes you edited last.")];
		if (s.loading) parts.push(Muted("Loading…"));
		else if (s.error) parts.push(Card([Badge("Error", { tone: "danger" }), ` Could not read notes: ${String(s.error.message ?? s.error)}`]));
		else if (!s.notes.length) parts.push(EmptyState("No notes yet", "Notes the app may read show up here."));
		else parts.push(List(s.notes.map((n) => ListItem(n.basename))));
		body.replaceChildren(...parts);
	});
	return () => { stop(); app.remove(); };
});
