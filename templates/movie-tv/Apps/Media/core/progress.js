// A download's progress bar in a table cell (ui-kit's bare meter with its reading), and the poll's in-place update of it.
import { meter } from "./ui-kit.js";

const TONES = { downloading: "warning", started: "accent", watching: "accent", importing: "success", blocked: "danger", failed: "danger" };

export function progressBar(parent, pct, kind) {
	const el = meter(parent, { layout: "bar", label: "Progress", value: pct ?? undefined, text: pct == null ? "–" : `${pct}%`, showText: true, tone: TONES[kind] });
	el.querySelector(".hel-meter-fill")?.classList.add("dl-bar-fill");
	el.querySelector(".hel-meter-text").classList.add("dl-bar-label");
	return el;
}

/** Moves the bar inside `row` to `pct` without redrawing the table. */
export function setProgress(row, pct) {
	const fill = row.querySelector(".dl-bar-fill"), label = row.querySelector(".dl-bar-label");
	if (!fill || !label) return;
	const text = `${Math.floor(pct)}%`;
	fill.style.width = `${pct}%`;
	label.textContent = text;
	fill.parentElement.setAttribute("aria-valuenow", String(Math.floor(pct)));
	fill.parentElement.setAttribute("aria-valuetext", text);
}
