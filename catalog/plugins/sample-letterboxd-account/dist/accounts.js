var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// catalog/plugins/sample-letterboxd-account/src/accounts.ts
var accounts_exports = {};
__export(accounts_exports, {
  decode: () => decode,
  default: () => LetterboxdAccountsEntry,
  letterboxd: () => letterboxd,
  parseDiaryRss: () => parseDiaryRss,
  parseWatchlist: () => parseWatchlist
});
module.exports = __toCommonJS(accounts_exports);
var import_obsidian = require("obsidian");
var import_helenite = require("helenite");

// catalog/plugins/sample-letterboxd-account/src/logo.ts
var LOGO_ICON = "letterboxd-account-logo";
var LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8.224 14.352a4.447 4.447 0 0 1-3.775 2.092C1.992 16.444 0 14.454 0 12s1.992-4.444 4.45-4.444c1.592 0 2.988.836 3.774 2.092-.427.682-.673 1.488-.673 2.352s.246 1.67.673 2.352zM15.101 12c0-.864.247-1.67.674-2.352-.786-1.256-2.183-2.092-3.775-2.092s-2.989.836-3.775 2.092c.427.682.674 1.488.674 2.352s-.247 1.67-.674 2.352c.786 1.256 2.183 2.092 3.775 2.092s2.989-.836 3.775-2.092A4.42 4.42 0 0 1 15.1 12zm4.45-4.444a4.447 4.447 0 0 0-3.775 2.092c.427.682.673 1.488.673 2.352s-.246 1.67-.673 2.352a4.447 4.447 0 0 0 3.775 2.092C22.008 16.444 24 14.454 24 12s-1.992-4.444-4.45-4.444z"/></svg>';

// catalog/plugins/sample-letterboxd-account/src/accounts.ts
var ORIGIN = "https://letterboxd.com";
var USERNAME = /^[A-Za-z0-9_-]+$/;
var HEADERS = { Accept: "text/html,application/xml", "User-Agent": "Helenite/0.1 (personal vault app)" };
var codePoint = (n) => Number.isInteger(n) && n > 0 && n <= 1114111 && !(n >= 55296 && n <= 57343) ? String.fromCodePoint(n) : "";
var decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
var tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : null;
};
var num = (s) => s == null || s === "" || Number.isNaN(Number(s)) ? null : Number(s);
function parseDiaryRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]).filter((it) => tag(it, "letterboxd:filmTitle")).map((it) => ({
    title: tag(it, "letterboxd:filmTitle"),
    year: num(tag(it, "letterboxd:filmYear")),
    rating: num(tag(it, "letterboxd:memberRating")),
    watchedDate: tag(it, "letterboxd:watchedDate"),
    rewatch: tag(it, "letterboxd:rewatch") === "Yes",
    link: tag(it, "link") ?? ""
  }));
}
function parseWatchlist(html) {
  const films = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of html.matchAll(/<(?:div|li)\b[^>]*data-(?:film-slug|item-slug)="([^"]+)"[^>]*>/g)) {
    const slug = m[1].replace(/^\/film\/|\/$/g, "");
    if (seen.has(slug)) continue;
    seen.add(slug);
    const name = m[0].match(/data-(?:film-name|item-name)="([^"]*)"/)?.[1];
    films.push({ slug, title: decode(name ?? slug.replace(/-/g, " ")) });
  }
  return { films, hasNext: /class="next"/.test(html) };
}
function userOf(account) {
  const name = String(account.config?.username ?? account.identity ?? "").trim();
  if (!USERNAME.test(name)) throw new Error("letterboxd: this account has no valid username");
  return name;
}
async function page(ctx, path) {
  const r = await ctx.fetch({ url: `${ORIGIN}${path}`, headers: HEADERS });
  if (r.status < 200 || r.status >= 300) throw new Error(`letterboxd: ${path} returned ${r.status}`);
  return r.text;
}
var letterboxd = {
  type: "letterboxd",
  icon: LOGO_ICON,
  connect(el, ctx) {
    const field = import_helenite.ui.field(el, { label: "Username", hint: "Your Letterboxd username. Only your public diary and watchlist are read; no password is needed." });
    const input = import_helenite.ui.textInput(field.control, { placeholder: "Username", onInput: () => field.setError(null) });
    import_helenite.ui.button(el, { text: ctx.accountId ? "Save" : "Connect", variant: "primary", onClick: async () => {
      const username = input.value.trim();
      if (!USERNAME.test(username)) return field.setError("Use letters, digits, \u201C-\u201D and \u201C_\u201D only.");
      try {
        await ctx.save({ identity: username, label: `Letterboxd (${username})`, config: { username }, held: ["diary.read", "watchlist.read"] });
      } catch (e) {
        field.setError(e instanceof Error ? e.message : String(e));
      }
    } });
  },
  methods: {
    async diary(account, ctx, args) {
      const entries = parseDiaryRss(await page(ctx, `/${userOf(account)}/rss/`));
      const n = Math.floor(Number(args?.limit));
      return n >= 1 ? entries.slice(0, n) : entries;
    },
    async watchlist(account, ctx, args) {
      const user = userOf(account);
      const max = Math.min(Math.max(Math.floor(Number(args?.maxPages ?? 5)) || 1, 1), 20);
      const films = [];
      for (let p = 1; p <= max; p++) {
        const r = parseWatchlist(await page(ctx, `/${user}/watchlist/page/${p}/`));
        films.push(...r.films);
        if (!r.hasNext) break;
      }
      return films;
    }
  }
};
var LetterboxdAccountsEntry = class extends import_obsidian.Plugin {
  onload() {
    (0, import_obsidian.addIcon)(LOGO_ICON, LOGO_SVG);
    this.register(() => (0, import_obsidian.removeIcon)(LOGO_ICON));
    this.registerAccountType(letterboxd);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decode,
  letterboxd,
  parseDiaryRss,
  parseWatchlist
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2FjY291bnRzLnRzIiwgIi4uL3NyYy9sb2dvLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBUaGUgYWNjb3VudC10eXBlIGVudHJ5IG9mIHRoZSBzYW1wbGUgcGx1Z2luIChgaGVsZW5pdGUuYWNjb3VudHMubWFpbmApLiBJdCBsb2FkcyBpbiBldmVyeSB3aW5kb3cgd2hpbGUgdGhlIHBsdWdpblxuLy8gaXMgZW5hYmxlZCBpbiBIb21lLiBUaGUgdHlwZSBpcyBkZWNsYXJlZCBpbiBtYW5pZmVzdC5qc29uICh0aGF0IGlzIHdoYXQgbWFpbiB0cnVzdHMpOyB0aGlzIGNvZGUgc3VwcGxpZXMgdGhlIGNvbm5lY3Rcbi8vIGZvcm0gYW5kIHRoZSBtZXRob2RzLiBMZXR0ZXJib3hkJ3MgcHVibGljIFJTUyBhbmQgd2F0Y2hsaXN0IHBhZ2VzIG5lZWQgbm8gc2VjcmV0LCBzbyB0aGUgYWNjb3VudCBob2xkcyBhIHVzZXJuYW1lXG4vLyBhbmQgbm90aGluZyBlbHNlLlxuaW1wb3J0IHsgYWRkSWNvbiwgUGx1Z2luLCByZW1vdmVJY29uLCB0eXBlIEFjY291bnRUeXBlRGVmLCB0eXBlIEFjY291bnRWaWV3LCB0eXBlIENhbGxDb250ZXh0LCB0eXBlIENvbm5lY3RDb250ZXh0IH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgdWkgfSBmcm9tICdoZWxlbml0ZSc7XG5pbXBvcnQgeyBMT0dPX0lDT04sIExPR09fU1ZHIH0gZnJvbSAnLi9sb2dvJztcblxuY29uc3QgT1JJR0lOID0gJ2h0dHBzOi8vbGV0dGVyYm94ZC5jb20nO1xuY29uc3QgVVNFUk5BTUUgPSAvXltBLVphLXowLTlfLV0rJC87XG5jb25zdCBIRUFERVJTID0geyBBY2NlcHQ6ICd0ZXh0L2h0bWwsYXBwbGljYXRpb24veG1sJywgJ1VzZXItQWdlbnQnOiAnSGVsZW5pdGUvMC4xIChwZXJzb25hbCB2YXVsdCBhcHApJyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIERpYXJ5RW50cnkgeyB0aXRsZTogc3RyaW5nOyB5ZWFyOiBudW1iZXIgfCBudWxsOyByYXRpbmc6IG51bWJlciB8IG51bGw7IHdhdGNoZWREYXRlOiBzdHJpbmcgfCBudWxsOyByZXdhdGNoOiBib29sZWFuOyBsaW5rOiBzdHJpbmcgfVxuZXhwb3J0IGludGVyZmFjZSBXYXRjaGxpc3RGaWxtIHsgc2x1Zzogc3RyaW5nOyB0aXRsZTogc3RyaW5nIH1cblxuY29uc3QgY29kZVBvaW50ID0gKG46IG51bWJlcikgPT4gKE51bWJlci5pc0ludGVnZXIobikgJiYgbiA+IDAgJiYgbiA8PSAweDEwZmZmZiAmJiAhKG4gPj0gMHhkODAwICYmIG4gPD0gMHhkZmZmKSA/IFN0cmluZy5mcm9tQ29kZVBvaW50KG4pIDogJycpO1xuLy8gYCZhbXA7YCBnb2VzIGxhc3Qgc28gYCZhbXA7bHQ7YCBkZWNvZGVzIHRvIGAmbHQ7YCwgbm90IGA8YC5cbmV4cG9ydCBjb25zdCBkZWNvZGUgPSAoczogc3RyaW5nKSA9PiBzLnJlcGxhY2UoLzwhXFxbQ0RBVEFcXFt8XFxdXFxdPi9nLCAnJykucmVwbGFjZSgvJiN4KFswLTlhLWZdKyk7L2dpLCAoXywgaCkgPT4gY29kZVBvaW50KHBhcnNlSW50KGgsIDE2KSkpLnJlcGxhY2UoLyYjKFxcZCspOy9nLCAoXywgZCkgPT4gY29kZVBvaW50KHBhcnNlSW50KGQsIDEwKSkpLnJlcGxhY2UoLyZsdDsvZywgJzwnKS5yZXBsYWNlKC8mZ3Q7L2csICc+JykucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpLnJlcGxhY2UoLyZhcG9zOy9nLCBcIidcIikucmVwbGFjZSgvJmFtcDsvZywgJyYnKTtcbmNvbnN0IHRhZyA9ICh4bWw6IHN0cmluZywgbmFtZTogc3RyaW5nKSA9PiB7IGNvbnN0IG0gPSB4bWwubWF0Y2gobmV3IFJlZ0V4cChgPCR7bmFtZX1bXj5dKj4oW1xcXFxzXFxcXFNdKj8pPC8ke25hbWV9PmApKTsgcmV0dXJuIG0gPyBkZWNvZGUobVsxXSkudHJpbSgpIDogbnVsbDsgfTtcbmNvbnN0IG51bSA9IChzOiBzdHJpbmcgfCBudWxsKSA9PiAocyA9PSBudWxsIHx8IHMgPT09ICcnIHx8IE51bWJlci5pc05hTihOdW1iZXIocykpID8gbnVsbCA6IE51bWJlcihzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURpYXJ5UnNzKHhtbDogc3RyaW5nKTogRGlhcnlFbnRyeVtdIHtcbiAgcmV0dXJuIFsuLi54bWwubWF0Y2hBbGwoLzxpdGVtPihbXFxzXFxTXSo/KTxcXC9pdGVtPi9nKV1cbiAgICAubWFwKChtKSA9PiBtWzFdKVxuICAgIC5maWx0ZXIoKGl0KSA9PiB0YWcoaXQsICdsZXR0ZXJib3hkOmZpbG1UaXRsZScpKVxuICAgIC5tYXAoKGl0KSA9PiAoe1xuICAgICAgdGl0bGU6IHRhZyhpdCwgJ2xldHRlcmJveGQ6ZmlsbVRpdGxlJykhLFxuICAgICAgeWVhcjogbnVtKHRhZyhpdCwgJ2xldHRlcmJveGQ6ZmlsbVllYXInKSksXG4gICAgICByYXRpbmc6IG51bSh0YWcoaXQsICdsZXR0ZXJib3hkOm1lbWJlclJhdGluZycpKSxcbiAgICAgIHdhdGNoZWREYXRlOiB0YWcoaXQsICdsZXR0ZXJib3hkOndhdGNoZWREYXRlJyksXG4gICAgICByZXdhdGNoOiB0YWcoaXQsICdsZXR0ZXJib3hkOnJld2F0Y2gnKSA9PT0gJ1llcycsXG4gICAgICBsaW5rOiB0YWcoaXQsICdsaW5rJykgPz8gJycsXG4gICAgfSkpO1xufVxuXG4vKiogUG9zdGVyIHRpbGVzIGNhcnJ5IGBkYXRhLWZpbG0tc2x1Z2AgKG9sZGVyIG1hcmt1cCBgZGF0YS1pdGVtLXNsdWdgKSBhbmQgYSBuYW1lIGF0dHJpYnV0ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVdhdGNobGlzdChodG1sOiBzdHJpbmcpOiB7IGZpbG1zOiBXYXRjaGxpc3RGaWxtW107IGhhc05leHQ6IGJvb2xlYW4gfSB7XG4gIGNvbnN0IGZpbG1zOiBXYXRjaGxpc3RGaWxtW10gPSBbXTtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IG0gb2YgaHRtbC5tYXRjaEFsbCgvPCg/OmRpdnxsaSlcXGJbXj5dKmRhdGEtKD86ZmlsbS1zbHVnfGl0ZW0tc2x1Zyk9XCIoW15cIl0rKVwiW14+XSo+L2cpKSB7XG4gICAgY29uc3Qgc2x1ZyA9IG1bMV0ucmVwbGFjZSgvXlxcL2ZpbG1cXC98XFwvJC9nLCAnJyk7XG4gICAgaWYgKHNlZW4uaGFzKHNsdWcpKSBjb250aW51ZTtcbiAgICBzZWVuLmFkZChzbHVnKTtcbiAgICBjb25zdCBuYW1lID0gbVswXS5tYXRjaCgvZGF0YS0oPzpmaWxtLW5hbWV8aXRlbS1uYW1lKT1cIihbXlwiXSopXCIvKT8uWzFdO1xuICAgIGZpbG1zLnB1c2goeyBzbHVnLCB0aXRsZTogZGVjb2RlKG5hbWUgPz8gc2x1Zy5yZXBsYWNlKC8tL2csICcgJykpIH0pO1xuICB9XG4gIHJldHVybiB7IGZpbG1zLCBoYXNOZXh0OiAvY2xhc3M9XCJuZXh0XCIvLnRlc3QoaHRtbCkgfTtcbn1cblxuLyoqIFRoZSB1c2VybmFtZSBjb21lcyBmcm9tIHRoZSBhY2NvdW50J3Mgc2F2ZWQgY29uZmlnLCBuZXZlciBmcm9tIHRoZSBjYWxsZXIuICovXG5mdW5jdGlvbiB1c2VyT2YoYWNjb3VudDogQWNjb3VudFZpZXcpOiBzdHJpbmcge1xuICBjb25zdCBuYW1lID0gU3RyaW5nKGFjY291bnQuY29uZmlnPy51c2VybmFtZSA/PyBhY2NvdW50LmlkZW50aXR5ID8/ICcnKS50cmltKCk7XG4gIGlmICghVVNFUk5BTUUudGVzdChuYW1lKSkgdGhyb3cgbmV3IEVycm9yKCdsZXR0ZXJib3hkOiB0aGlzIGFjY291bnQgaGFzIG5vIHZhbGlkIHVzZXJuYW1lJyk7XG4gIHJldHVybiBuYW1lO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwYWdlKGN0eDogQ2FsbENvbnRleHQsIHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHIgPSBhd2FpdCBjdHguZmV0Y2goeyB1cmw6IGAke09SSUdJTn0ke3BhdGh9YCwgaGVhZGVyczogSEVBREVSUyB9KTtcbiAgaWYgKHIuc3RhdHVzIDwgMjAwIHx8IHIuc3RhdHVzID49IDMwMCkgdGhyb3cgbmV3IEVycm9yKGBsZXR0ZXJib3hkOiAke3BhdGh9IHJldHVybmVkICR7ci5zdGF0dXN9YCk7XG4gIHJldHVybiByLnRleHQ7XG59XG5cbmV4cG9ydCBjb25zdCBsZXR0ZXJib3hkOiBBY2NvdW50VHlwZURlZiA9IHtcbiAgdHlwZTogJ2xldHRlcmJveGQnLFxuICBpY29uOiBMT0dPX0lDT04sXG4gIGNvbm5lY3QoZWw6IEhUTUxFbGVtZW50LCBjdHg6IENvbm5lY3RDb250ZXh0KSB7XG4gICAgY29uc3QgZmllbGQgPSB1aS5maWVsZChlbCwgeyBsYWJlbDogJ1VzZXJuYW1lJywgaGludDogJ1lvdXIgTGV0dGVyYm94ZCB1c2VybmFtZS4gT25seSB5b3VyIHB1YmxpYyBkaWFyeSBhbmQgd2F0Y2hsaXN0IGFyZSByZWFkOyBubyBwYXNzd29yZCBpcyBuZWVkZWQuJyB9KTtcbiAgICBjb25zdCBpbnB1dCA9IHVpLnRleHRJbnB1dChmaWVsZC5jb250cm9sLCB7IHBsYWNlaG9sZGVyOiAnVXNlcm5hbWUnLCBvbklucHV0OiAoKSA9PiBmaWVsZC5zZXRFcnJvcihudWxsKSB9KTtcbiAgICB1aS5idXR0b24oZWwsIHsgdGV4dDogY3R4LmFjY291bnRJZCA/ICdTYXZlJyA6ICdDb25uZWN0JywgdmFyaWFudDogJ3ByaW1hcnknLCBvbkNsaWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB1c2VybmFtZSA9IGlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIGlmICghVVNFUk5BTUUudGVzdCh1c2VybmFtZSkpIHJldHVybiBmaWVsZC5zZXRFcnJvcignVXNlIGxldHRlcnMsIGRpZ2l0cywgXHUyMDFDLVx1MjAxRCBhbmQgXHUyMDFDX1x1MjAxRCBvbmx5LicpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgY3R4LnNhdmUoeyBpZGVudGl0eTogdXNlcm5hbWUsIGxhYmVsOiBgTGV0dGVyYm94ZCAoJHt1c2VybmFtZX0pYCwgY29uZmlnOiB7IHVzZXJuYW1lIH0sIGhlbGQ6IFsnZGlhcnkucmVhZCcsICd3YXRjaGxpc3QucmVhZCddIH0pO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBmaWVsZC5zZXRFcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpO1xuICAgICAgfVxuICAgIH0gfSk7XG4gIH0sXG4gIG1ldGhvZHM6IHtcbiAgICBhc3luYyBkaWFyeShhY2NvdW50LCBjdHgsIGFyZ3M/OiB7IGxpbWl0PzogbnVtYmVyIH0pIHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBwYXJzZURpYXJ5UnNzKGF3YWl0IHBhZ2UoY3R4LCBgLyR7dXNlck9mKGFjY291bnQpfS9yc3MvYCkpO1xuICAgICAgY29uc3QgbiA9IE1hdGguZmxvb3IoTnVtYmVyKGFyZ3M/LmxpbWl0KSk7XG4gICAgICByZXR1cm4gbiA+PSAxID8gZW50cmllcy5zbGljZSgwLCBuKSA6IGVudHJpZXM7XG4gICAgfSxcbiAgICBhc3luYyB3YXRjaGxpc3QoYWNjb3VudCwgY3R4LCBhcmdzPzogeyBtYXhQYWdlcz86IG51bWJlciB9KSB7XG4gICAgICBjb25zdCB1c2VyID0gdXNlck9mKGFjY291bnQpO1xuICAgICAgY29uc3QgbWF4ID0gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5mbG9vcihOdW1iZXIoYXJncz8ubWF4UGFnZXMgPz8gNSkpIHx8IDEsIDEpLCAyMCk7XG4gICAgICBjb25zdCBmaWxtczogV2F0Y2hsaXN0RmlsbVtdID0gW107XG4gICAgICBmb3IgKGxldCBwID0gMTsgcCA8PSBtYXg7IHArKykge1xuICAgICAgICBjb25zdCByID0gcGFyc2VXYXRjaGxpc3QoYXdhaXQgcGFnZShjdHgsIGAvJHt1c2VyfS93YXRjaGxpc3QvcGFnZS8ke3B9L2ApKTtcbiAgICAgICAgZmlsbXMucHVzaCguLi5yLmZpbG1zKTtcbiAgICAgICAgaWYgKCFyLmhhc05leHQpIGJyZWFrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbG1zO1xuICAgIH0sXG4gIH0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMZXR0ZXJib3hkQWNjb3VudHNFbnRyeSBleHRlbmRzIFBsdWdpbiB7XG4gIG9ubG9hZCgpOiB2b2lkIHtcbiAgICBhZGRJY29uKExPR09fSUNPTiwgTE9HT19TVkcpO1xuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gcmVtb3ZlSWNvbihMT0dPX0lDT04pKTtcbiAgICB0aGlzLnJlZ2lzdGVyQWNjb3VudFR5cGUobGV0dGVyYm94ZCk7XG4gIH1cbn1cbiIsICIvLyBMZXR0ZXJib3hkIGxvZ28gZnJvbSBTaW1wbGUgSWNvbnMgKENDMCAxLjAsIGh0dHBzOi8vc2ltcGxlaWNvbnMub3JnKS4gRHJhd24gaW4gdGhlIHRoZW1lJ3MgdGV4dCBjb2xvdXIsIGxpa2UgSGVsZW5pdGUncyBvdGhlciBpY29ucy5cbmV4cG9ydCBjb25zdCBMT0dPX0lDT04gPSAnbGV0dGVyYm94ZC1hY2NvdW50LWxvZ28nO1xuZXhwb3J0IGNvbnN0IExPR09fU1ZHID0gJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIj48cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgZD1cIk04LjIyNCAxNC4zNTJhNC40NDcgNC40NDcgMCAwIDEtMy43NzUgMi4wOTJDMS45OTIgMTYuNDQ0IDAgMTQuNDU0IDAgMTJzMS45OTItNC40NDQgNC40NS00LjQ0NGMxLjU5MiAwIDIuOTg4LjgzNiAzLjc3NCAyLjA5Mi0uNDI3LjY4Mi0uNjczIDEuNDg4LS42NzMgMi4zNTJzLjI0NiAxLjY3LjY3MyAyLjM1MnpNMTUuMTAxIDEyYzAtLjg2NC4yNDctMS42Ny42NzQtMi4zNTItLjc4Ni0xLjI1Ni0yLjE4My0yLjA5Mi0zLjc3NS0yLjA5MnMtMi45ODkuODM2LTMuNzc1IDIuMDkyYy40MjcuNjgyLjY3NCAxLjQ4OC42NzQgMi4zNTJzLS4yNDcgMS42Ny0uNjc0IDIuMzUyYy43ODYgMS4yNTYgMi4xODMgMi4wOTIgMy43NzUgMi4wOTJzMi45ODktLjgzNiAzLjc3NS0yLjA5MkE0LjQyIDQuNDIgMCAwIDEgMTUuMSAxMnptNC40NS00LjQ0NGE0LjQ0NyA0LjQ0NyAwIDAgMC0zLjc3NSAyLjA5MmMuNDI3LjY4Mi42NzMgMS40ODguNjczIDIuMzUycy0uMjQ2IDEuNjctLjY3MyAyLjM1MmE0LjQ0NyA0LjQ0NyAwIDAgMCAzLjc3NSAyLjA5MkMyMi4wMDggMTYuNDQ0IDI0IDE0LjQ1NCAyNCAxMnMtMS45OTItNC40NDQtNC40NS00LjQ0NHpcIi8+PC9zdmc+JztcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFJQSxzQkFBMEg7QUFDMUgsc0JBQW1COzs7QUNKWixJQUFNLFlBQVk7QUFDbEIsSUFBTSxXQUFXOzs7QURNeEIsSUFBTSxTQUFTO0FBQ2YsSUFBTSxXQUFXO0FBQ2pCLElBQU0sVUFBVSxFQUFFLFFBQVEsNkJBQTZCLGNBQWMsb0NBQW9DO0FBS3pHLElBQU0sWUFBWSxDQUFDLE1BQWUsT0FBTyxVQUFVLENBQUMsS0FBSyxJQUFJLEtBQUssS0FBSyxXQUFZLEVBQUUsS0FBSyxTQUFVLEtBQUssU0FBVSxPQUFPLGNBQWMsQ0FBQyxJQUFJO0FBRXRJLElBQU0sU0FBUyxDQUFDLE1BQWMsRUFBRSxRQUFRLHNCQUFzQixFQUFFLEVBQUUsUUFBUSxxQkFBcUIsQ0FBQyxHQUFHLE1BQU0sVUFBVSxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLGFBQWEsQ0FBQyxHQUFHLE1BQU0sVUFBVSxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxRQUFRLFNBQVMsR0FBRyxFQUFFLFFBQVEsU0FBUyxHQUFHLEVBQUUsUUFBUSxXQUFXLEdBQUcsRUFBRSxRQUFRLFdBQVcsR0FBRyxFQUFFLFFBQVEsVUFBVSxHQUFHO0FBQ3hULElB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
