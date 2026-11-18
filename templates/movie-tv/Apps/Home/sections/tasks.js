// "Due this week" and "Recent notes": the two Dataview blocks the dashboard used before it became a movie page,
// rebuilt on api.notes.query (recent notes) and a scan of the newest notes' bodies (Tasks-plugin emoji tasks).
import { dueThisWeek, parseTasks } from "../tasks-data.js";
import { fmtMonthDay, iso, parse, startOfDay } from "../dates.js";
import { div, el, link } from "../ui.js";
import { emptyState } from "../ui-kit.js";

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
	const box = div(root, "home-panel");
	div(box, "home-panel-title", "Due this week");
	if (!due.length) return emptyState(box, "Nothing due this week.");
	const todayIso = iso(startOfDay(ctx.today));
	const ul = el(box, "ul", { cls: "home-tasks" });
	for (const t of due) {
		const li = el(ul, "li", { cls: t.due < todayIso ? "is-overdue" : "" });
		el(li, "span", { cls: "home-task-due", text: fmtMonthDay(parse(t.due)) });
		link(li, { cls: "home-task-text", text: t.text, title: t.path, onClick: e => ctx.openNote(t.path, e) });
	}
}

export function renderRecent(root, ctx, notes, limit = 10) {
	const box = div(root, "home-panel");
	div(box, "home-panel-title", "Recent notes");
	if (!notes.length) return emptyState(box, "No notes yet.");
	const ul = el(box, "ul", { cls: "home-recent" });
	for (const n of notes.slice(0, limit)) {
		const li = el(ul, "li");
		link(li, { text: n.basename, title: n.path, onClick: e => ctx.openNote(n.path, e) });
		if (n.mtime) el(li, "span", { cls: "home-recent-when", text: fmtMonthDay(new Date(n.mtime)) });
	}
}
