// "Due this week" and "Recent notes": the two Dataview blocks the dashboard used before it became a movie page,
// rebuilt on api.notes.query (recent notes) and a scan of the newest notes' bodies (Tasks-plugin emoji tasks).
import { dueThisWeek, parseTasks } from "../tasks-data.js";
import { fmtMonthDay, iso, parse, startOfDay } from "../dates.js";
import { emptyState, listRow } from "../../../core/ui-kit.js";
import { panel } from "../panel.js";

// Folders worth listing: where the vault's own notes live (never Letterboxd/People, 00_Home or any secret file).
export const NOTE_GLOBS = ["10_Inbox/**/*.md", "20_Contacts/**/*.md", "40_Notes/**/*.md", "50_Personal/Places/**/*.md", "50_Personal/History/**/*.md"];

export async function loadNotes(api, limit = 80) {
	const lists = await Promise.all(NOTE_GLOBS.map(from => api.notes.query({ from }).catch(() => [])));
	return lists.flat().sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0)).slice(0, limit);
}

export async function loadTasks(api, notes) {
	const all = [];
	for (const n of notes.slice(0, 60)) {
		try { all.push(...parseTasks(await api.vault.read(n.path), n.path)); } catch { /* unreadable: skip */ }
	}
	return all;
}

export function renderTasks(root, ctx, tasks) {
	const due = dueThisWeek(tasks, ctx.today);
	const box = panel(root, "Due this week", "home-tasks");
	if (!due.length) return emptyState(box, "Nothing due this week.", { variant: "inline" });
	const todayIso = iso(startOfDay(ctx.today));
	for (const t of due) {
		const overdue = t.due < todayIso;
		const row = listRow(box, { title: t.text, status: { text: fmtMonthDay(parse(t.due)), tone: overdue ? "danger" : "default", title: overdue ? "Overdue" : "Due" }, onClick: e => ctx.openNote(t.path, e) });
		row.title = t.path;
		if (overdue) row.classList.add("is-overdue");
	}
}

export function renderRecent(root, ctx, notes, limit = 10) {
	const box = panel(root, "Recent notes", "home-recent");
	if (!notes.length) return emptyState(box, "No notes yet.", { variant: "inline" });
	for (const n of notes.slice(0, limit)) {
		listRow(box, { title: n.basename, meta: n.mtime ? fmtMonthDay(new Date(n.mtime)) : undefined, onClick: e => ctx.openNote(n.path, e) }).title = n.path;
	}
}
