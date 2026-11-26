// Poster cards shared by the Movies and TV pages: ui-kit's media card.
import { mediaCard } from "./ui-kit.js";

// A Radarr/Sonarr record's poster URL, or null. (The Movies page also tries a lookup result's `remotePoster` first.)
export const posterOf = s => (s?.images ?? []).find(i => i.coverType === "poster")?.remoteUrl ?? null;

// A card led by the poster, which opens `url` (the note's Letterboxd/Serializd page) through `open(event)`. `site` names
// the destination for screen readers. Text goes into the returned card's `body`, buttons into its `footer`.
export function posterCard(grid, { title, url, poster, site, open, selected, focused }) {
	const card = mediaCard(grid, {
		art: { title, src: poster, label: `${title} on ${site}`, tooltip: title, onClick: url ? open : undefined },
		selected, focused,
	});
	card.art.classList.add("dl-poster-link");
	card.art.title = title;
	card.el.classList.add("dl-card");
	return card;
}
