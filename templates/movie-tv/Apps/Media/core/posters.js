// Poster helpers shared by the Movies and TV pages. Needs the Obsidian-style element helpers (createDiv, createEl, addClass,
// setText) that the host gives app views.

// A Radarr/Sonarr record's poster URL, or null. (The Movies page also tries a lookup result's `remotePoster` first.)
export const posterOf = s => (s?.images ?? []).find(i => i.coverType === "poster")?.remoteUrl ?? null;

// The poster block of a card: a link to `url` (the note's Letterboxd/Serializd page) around the artwork, or the title when
// there is no poster. `site` names the destination for screen readers ("Letterboxd", "Serializd").
// Lifted from Downloadrr/cards.js and DownloadrrTV/draw.js, which differ only in these two words.
export function renderPoster(card, { title, url, poster, site }) {
	const link = card.createEl("a", { cls: "dl-poster-link", attr: { href: url ?? "#", title } });
	const art = link.createDiv({ cls: "dl-poster", attr: { role: "img", "aria-label": `${title} on ${site}` } });
	if (poster) art.style.backgroundImage = `url("${poster}")`;
	else { art.addClass("dl-poster-missing"); art.setText(title); }
	return { link, art };
}
