import { useNotes } from "./helenite/index.jsx";

export default function App() {
	const { notes, loading, error, refresh } = useNotes({ from: "**/*.md", sort: (a, b) => b.mtime - a.mtime, limit: 10 });
	return (
		<div class="app">
			<h1>{{{nameJs}}}</h1>
			<p class="muted">The ten notes you edited last.</p>
			{loading && <p class="muted">Loading…</p>}
			{error && <p>Could not read notes: {String(error.message ?? error)}</p>}
			<ul>{notes.map((n) => <li key={n.path}>{n.basename}</li>)}</ul>
			<button onClick={refresh}>Refresh</button>
		</div>
	);
}
