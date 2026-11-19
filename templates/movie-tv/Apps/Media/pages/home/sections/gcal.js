// Google Calendar through Session J's `google-calendar` connector (api.connectors["google-calendar"].listEvents).
// Until the user has connected it (Settings -> Secrets -> Google Calendar -> Connect), the call fails and this card says
// "connect your calendar". The OAuth flow is host-level, so the card only points at it and offers a retry.
import { addDays, fmtMonthDay, parse, startOfDay } from "../dates.js";
import { div, el } from "../ui.js";
import { button, emptyState } from "../../../core/ui-kit.js";

const timeOf = s => {
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export async function loadEvents(api, today) {
	const gc = api.connectors?.["google-calendar"];
	if (!gc) return { state: "unavailable" };
	const from = startOfDay(today), to = addDays(from, 7);
	try {
		return { state: "ok", events: (await gc.listEvents({ timeMin: from.toISOString(), timeMax: to.toISOString(), max: 50 })) ?? [] };
	} catch (e) {
		// Not connected yet (missing token/client id) and any other failure look the same to the user: connect, then retry.
		return { state: "disconnected", message: e?.message ?? String(e) };
	}
}

export function renderCalendarEvents(root, ctx, result) {
	const box = div(root, "home-panel");
	div(box, "home-panel-title", "Google Calendar");
	if (result.state === "ok") {
		if (!result.events.length) return emptyState(box, "No events in the next 7 days.");
		const ul = el(box, "ul", { cls: "home-events" });
		for (const ev of result.events.slice(0, 12)) {
			const li = el(ul, "li");
			const day = String(ev.start ?? "").slice(0, 10);
			el(li, "span", { cls: "home-event-when", text: `${day ? fmtMonthDay(parse(day) ?? new Date(ev.start)) : ""}${ev.allDay ? "" : ` ${timeOf(ev.start)}`}`.trim() });
			el(li, "span", { cls: "home-event-title", text: ev.summary ?? "(no title)" });
		}
		return;
	}
	const connect = div(box, "home-connect");
	emptyState(connect, result.state === "unavailable"
		? "Connect your calendar: the Google Calendar connector is not available in this build yet."
		: "Connect your calendar to see the week's events here: Settings → Secrets → Google Calendar → Connect.");
	button(connect, { text: "I've connected it: retry", disabled: result.state === "unavailable", onClick: () => ctx.refresh() });
}
