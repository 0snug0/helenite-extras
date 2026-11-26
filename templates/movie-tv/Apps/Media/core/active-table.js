// The "On disk & downloading" section shared by the Movies and TV pages: its heading and the columns of its table.
// Nothing in the table may move when a row changes state: every column but the title has a fixed width.
import { sectionHeading, statusText } from "./ui-kit.js";
import { formatSize } from "./releases.js";

const WIDTHS = { act: "136px", pos: "36px", year: "68px", episodes: "140px", date: "104px", status: "116px", size: "88px", progress: "140px", lb: "64px", sz: "64px", rt: "64px", aud: "64px" };

// The heading: what is on disk and downloading, and the free space on the service's root folder.
export function activeSection(parent, { count, total, free, service }) {
	const sec = parent.createDiv({ cls: "dl-active" });
	const head = sectionHeading(sec, { title: `On disk & downloading (${count}) · ${formatSize(total)}`, level: 2 });
	if (free != null) {
		const text = free >= 1e12 ? `${(free / 1e12).toFixed(2)} TB` : formatSize(free);
		const el = statusText(head.actions, `${text} free`);
		el.classList.add("dl-free");
		el.title = `Free space on ${service}'s root folder`;
	}
	return sec;
}

// cols: [[sort key, label, right-aligned number column, sortable]]; logos: { key: svg } drawn in place of a label;
// cells: { key: (row, td) => string | void }. `act` and `pos` (the actions and the queue place) come first.
export function activeColumns({ cols, logos, cells }) {
	const column = (key, extra) => ({ key, width: WIDTHS[key], cell: cells[key], ...extra });
	return [
		column("act", { title: "", headTitle: "Actions" }),
		column("pos", { title: "#", headTitle: "Place in the download queue", align: "end" }),
		...cols.map(([key, label, num, sortable]) => column(key, {
			title: label,
			align: num ? "end" : undefined,
			truncate: key === "title",
			tree: key === "title",
			sortable: sortable !== false,
			className: [key === "title" ? "dl-cell-title" : "", sortable !== false ? "dl-th" : ""].join(" ").trim(),
			...(logos[key] ? { headTitle: label, head: el => { el.innerHTML = logos[key]; } } : {}),
		})),
	];
}
