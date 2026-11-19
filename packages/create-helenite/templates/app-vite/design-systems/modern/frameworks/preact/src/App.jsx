import { useNotes } from "./helenite/index.jsx";
import { Badge, Button, Card, EmptyState, Grid, List, ListItem, Muted, Row, Stack, Stat, Title } from "./ds/index.jsx";

export default function App() {
	const { notes, loading, error, refresh } = useNotes({ from: "**/*.md", sort: (a, b) => b.mtime - a.mtime, limit: 10 });
	return (
		<div class="app">
			<Stack>
				<Row between>
					<Title>{{{nameJs}}}</Title>
					<Button variant="primary" onClick={refresh}>Refresh</Button>
				</Row>
				<Grid min="10rem"><Card><Stat label="Notes shown" value={notes.length} /></Card><Card><Stat label="Latest" value={notes[0]?.basename ?? "-"} /></Card></Grid>
				<Muted>The ten notes you edited last.</Muted>
				{loading && <Muted>Loading…</Muted>}
				{error && <Card><Badge tone="danger">Error</Badge> Could not read notes: {String(error.message ?? error)}</Card>}
				{!loading && !error && notes.length === 0 && <EmptyState title="No notes yet">Notes the app may read show up here.</EmptyState>}
				{notes.length > 0 && <List>{notes.map((n) => <ListItem key={n.path}>{n.basename}</ListItem>)}</List>}
			</Stack>
		</div>
	);
}
