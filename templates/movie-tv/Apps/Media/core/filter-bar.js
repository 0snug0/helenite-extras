// The bar over the cards on the Movies and TV pages: title filter, status filter, "My streaming" and the sort order.
import { button, dropdown, searchInput, segmented, toolbar } from "./ui-kit.js";

export function filterBar(parent, { query, onQuery, filters, filter, onFilter, streaming, streamingCount, onStreaming, sorts, sort, sortLabel, onSort }) {
	const bar = toolbar(parent);
	bar.classList.add("dl-filters");
	const find = searchInput(bar, { placeholder: "Filter by title (Ctrl/Cmd+F)", value: query, delayMs: 0, onSearch: onQuery });
	find.classList.add("dl-textfilter");
	find.setAttribute("aria-label", "Filter by title");
	segmented(bar, { options: filters, value: filter, onChange: onFilter });
	button(bar, { text: `My streaming (${streamingCount})`, pressed: streaming, onClick: onStreaming }).el.title = "Streaming on Netflix, HBO, Apple TV or Amazon";
	const select = dropdown(bar, { options: sorts.map(([value, text]) => ({ value, text })), value: sort, label: sortLabel, compact: true, onChange: onSort }).el;
	select.classList.add("dl-sort", "hel-toolbar-end");
}
