// Tasks plugin emoji format: "- [ ] text 📅 2026-11-12". Statuses: " " todo, "/" in progress, "x" done, "-" cancelled.
import { addDays, iso, startOfDay, startOfWeek } from "./dates.js";

const TASK = /^\s*[-*+]\s+\[(.)\]\s+(.*)$/;

export function parseTasks(text, path) {
	const out = [];
	for (const line of String(text ?? "").split("\n")) {
		const m = line.match(TASK);
		if (!m) continue;
		const due = (m[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/) || [])[1] ?? null;
		const clean = m[2].replace(/\s*(📅|⏳|🛫|➕|✅|🔁|⏫|🔼|🔽)\s*[\d-]*/g, "").replace(/\s+/g, " ").trim();
		out.push({ status: m[1], done: m[1] === "x" || m[1] === "X" || m[1] === "-", text: clean || m[2].trim(), due, path });
	}
	return out;
}

// Open tasks with a due date up to the end of this ISO week (overdue ones included), soonest first.
export function dueThisWeek(tasks, now = new Date()) {
	const end = iso(addDays(startOfWeek(startOfDay(now)), 6));
	return tasks.filter(t => !t.done && t.due && t.due <= end).sort((a, b) => a.due.localeCompare(b.due) || a.text.localeCompare(b.text));
}
