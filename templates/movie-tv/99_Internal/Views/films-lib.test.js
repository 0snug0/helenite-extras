// Run: node --test 99_Internal/Views/films-lib.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lib = new Function("module", fs.readFileSync(path.join(__dirname, "films-lib.js"), "utf8"))(undefined);

const dt = s => ({ toISODate: () => s });   // stands in for the luxon DateTime Dataview hands back

test("watchRows gives one row per viewing, with its own rating", () => {
	const getOut = { title: "Get Out", watches: [dt("2019-03-02"), dt("2026-10-04")], ratings: [8, 9] };
	const raw = { title: "Raw", watches: ["2024-01-02"], ratings: [null] };
	const unseen = { title: "Sinners", watches: [], ratings: [] };
	const rows = lib.watchRows([getOut, raw, unseen, { title: "No lists" }]);
	assert.deepEqual(rows.map(r => [r.p.title, r.date, r.rating, r.n]),
		[["Get Out", "2019-03-02", 8, 0], ["Get Out", "2026-10-04", 9, 1], ["Raw", "2024-01-02", null, 0]]);
});

test("watchRows carries each watch's Letterboxd entry id, and \"\" when the list is missing or shorter", () => {
	const a = { title: "A", watches: ["2026-01-01", "2026-02-01"], letterboxd_guids: ["1234"] };
	const b = { title: "B", watches: ["2026-01-01"] };
	assert.deepEqual(lib.watchRows([a, b]).map(r => r.guid), ["1234", "", ""]);
});

test("order puts a day's watches in logged order: no id first, then ids numerically; earlier dates always first", () => {
	const row = (title, date, guid, n = 0) => ({ p: { title }, date, guid, n });
	const rows = [row("Late", "2026-10-04", "1000"), row("Mid", "2026-10-04", "200"), row("Old", "2026-10-04", ""), row("Earlier", "2026-10-03", "99999999")];
	assert.deepEqual(rows.sort((x, y) => lib.order(x).localeCompare(lib.order(y))).map(r => r.p.title), ["Earlier", "Old", "Mid", "Late"]);
});

test("watchRows reads a single watch that YAML gave as a scalar, and skips junk dates", () => {
	assert.deepEqual(lib.watchRows([{ watches: dt("2026-01-01"), ratings: 7 }]).map(r => [r.date, r.rating]), [["2026-01-01", 7]]);
	assert.equal(lib.watchRows([{ watches: ["soon"], ratings: [1] }]).length, 0);
});

test("reviewedDates finds only watch sections that carry a quote", () => {
	const body = "# Get Out (2017)\n\n## Watches\n\n### 2026-10-04 ★★★★½\n\n> Loved it.\n\n[Letterboxd entry](x)\n\n### 2019-03-02 ★★★★\n\n[Letterboxd entry](y)\n\n## My notes\n\n> a quote of my own\n";
	assert.deepEqual([...lib.reviewedDates(body)], ["2026-10-04"]);
});

test("filmIndex matches a card by TMDB movie id, then by Letterboxd slug, never by a tv id", () => {
	const a = { tmdb_id: 419430, tmdb_type: "movie" }, b = { letterboxd_slug: "raw-2016" }, show = { tmdb_id: 7, tmdb_type: "tv" };
	const find = lib.filmIndex([a, b, show]);
	assert.equal(find({ tmdb_id: "419430" }), a);
	assert.equal(find({ tmdb_id: 1, letterboxd_url: "https://letterboxd.com/film/raw-2016/" }), b);
	assert.equal(find({ tmdb_id: 7 }), null);
});

test("setKeys replaces a key in place, appends a missing one, and leaves the body and other keys alone", () => {
	const text = "---\ntitle: \"Get Out\"\npending: false\nwatches: [2019-03-02]\n---\n\n# Get Out\n\npending: false in the body stays\n";
	const out = lib.setKeys(text, { pending: true, pending_added: "2026-10-08" });
	assert.equal(out, "---\ntitle: \"Get Out\"\npending: true\nwatches: [2019-03-02]\npending_added: 2026-10-08\n---\n\n# Get Out\n\npending: false in the body stays\n");
	assert.equal(lib.setKeys("no frontmatter", { pending: true }), "no frontmatter");
});

test("newFilmNote writes the shape film_store.py reads", () => {
	const note = lib.newFilmNote({ title: "Spider-Man: Brand New Day", year: 2026, tmdb_id: 969681, poster: "https://img/p.jpg", letterboxd_url: "https://letterboxd.com/tmdb/969681/" }, "2026-10-08", { pending: true });
	assert.match(note, /^---\nType: "Film"\nAlias: "Spider-Man: Brand New Day"\ntitle: "Spider-Man: Brand New Day"\nyear: 2026\ntmdb_id: 969681\ntmdb_type: "movie"\n/);
	assert.match(note, /\npending: true\npending_added: 2026-10-08\n/);
	assert.match(note, /\nadded: 2026-10-08\nscore_day: 3\n---\n/);            // 2026-10-08 is a Thursday; Monday = 0
	assert.match(note, /\n# Spider-Man: Brand New Day \(2026\)\n\n!\[Poster\]\(https:\/\/img\/p\.jpg\)\n\n%% credits:start %%\n%% credits:end %%\n\n## Watches\n$/);
	assert.equal(lib.fileStem({ title: "Spider-Man: Brand New Day", year: 2026 }), "Spider-Man Brand New Day (2026)");
});

test("fileStem drops the characters that break wikilinks", () => {
	assert.equal(lib.fileStem({ title: "[REC]", year: 2007 }), "REC (2007)");
	assert.equal(lib.fileStem({ title: "#Alive", year: 2020 }), "Alive (2020)");
	assert.equal(lib.safeName("Caf^e"), "Cafe");
});

test("nameOf falls back to the file name when Dataview parsed the title as something else", () => {
	const duration = { values: { hours: 127 } };   // what Dataview makes of `title: "127 Hours"`
	assert.equal(lib.nameOf({ title: duration, file: { name: "127 Hours (2010)" } }), "127 Hours");
	assert.equal(lib.nameOf({ title: dt("2012-01-01"), file: { name: "2012 (2009) (tmdb-14161)" } }), "2012");
	assert.equal(lib.nameOf({ title: 1917, file: { name: "1917 (2019)" } }), "1917");
	assert.equal(lib.nameOf({ title: "Get Out", file: { name: "Something Else (2017)" } }), "Get Out");
	assert.equal(lib.nameOf({ file: { name: "Raw (2016)" } }), "Raw");
});
