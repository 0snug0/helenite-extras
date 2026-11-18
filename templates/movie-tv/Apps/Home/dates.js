// Small local-time date helpers. The dashboard used luxon (via Dataview); the sandbox has no libraries,
// and everything here is plain "YYYY-MM-DD" arithmetic.
export const pad = n => String(n).padStart(2, "0");
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => {
	const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfWeek = d => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // Monday
export const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const sameDay = (a, b) => iso(a) === iso(b);
// Monday = 1 ... Sunday = 7.
export const weekday = d => ((d.getDay() + 6) % 7) + 1;

// ISO 8601 week: the week with the year's first Thursday is week 1.
export function isoWeek(d) {
	const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const year = t.getUTCFullYear();
	const week = Math.ceil(((t - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
	return { year, week };
}
export const weeksInYear = year => isoWeek(new Date(year, 11, 28)).week;
export const dayOfYear = d => Math.round((startOfDay(d) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
// Monday of ISO week `week` in ISO year `year`.
export function isoWeekStart(year, week) {
	const jan4 = new Date(year, 0, 4);
	return addDays(startOfWeek(jan4), (week - 1) * 7);
}

export const monthShort = d => MONTHS[d.getMonth()].slice(0, 3);
export const fmtMonthDay = d => `${monthShort(d)} ${d.getDate()}`;
export const fmtDayLabel = d => `${WEEKDAYS[weekday(d) - 1]} ${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
export const fmtLong = d => `${monthShort(d)} ${d.getDate()}, ${d.getFullYear()}`;
export const fmtWeekRange = (start, end) => `${isoWeek(start).year}-W${pad(isoWeek(start).week)} · ${fmtMonthDay(start)} – ${fmtMonthDay(end)}`;
