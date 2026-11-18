// The account-type entry of the sample plugin (`helenite.accounts.main`). It loads in every window while the plugin
// is enabled in Home. The type is declared in manifest.json (that is what main trusts); this code supplies the connect
// form and the methods. Letterboxd's public RSS and watchlist pages need no secret, so the account holds a username
// and nothing else.
import { addIcon, Plugin, removeIcon, type AccountTypeDef, type AccountView, type CallContext, type ConnectContext } from 'obsidian';
import { ui } from 'helenite';
import { LOGO_ICON, LOGO_SVG } from './logo';

const ORIGIN = 'https://letterboxd.com';
const USERNAME = /^[A-Za-z0-9_-]+$/;
const HEADERS = { Accept: 'text/html,application/xml', 'User-Agent': 'Helenite/0.1 (personal vault app)' };

export interface DiaryEntry { title: string; year: number | null; rating: number | null; watchedDate: string | null; rewatch: boolean; link: string }
export interface WatchlistFilm { slug: string; title: string }

const codePoint = (n: number) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '');
// `&amp;` goes last so `&amp;lt;` decodes to `&lt;`, not `<`.
export const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]).trim() : null; };
const num = (s: string | null) => (s == null || s === '' || Number.isNaN(Number(s)) ? null : Number(s));

export function parseDiaryRss(xml: string): DiaryEntry[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => m[1])
    .filter((it) => tag(it, 'letterboxd:filmTitle'))
    .map((it) => ({
      title: tag(it, 'letterboxd:filmTitle')!,
      year: num(tag(it, 'letterboxd:filmYear')),
      rating: num(tag(it, 'letterboxd:memberRating')),
      watchedDate: tag(it, 'letterboxd:watchedDate'),
      rewatch: tag(it, 'letterboxd:rewatch') === 'Yes',
      link: tag(it, 'link') ?? '',
    }));
}

/** Poster tiles carry `data-film-slug` (older markup `data-item-slug`) and a name attribute. */
export function parseWatchlist(html: string): { films: WatchlistFilm[]; hasNext: boolean } {
  const films: WatchlistFilm[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<(?:div|li)\b[^>]*data-(?:film-slug|item-slug)="([^"]+)"[^>]*>/g)) {
    const slug = m[1].replace(/^\/film\/|\/$/g, '');
    if (seen.has(slug)) continue;
    seen.add(slug);
    const name = m[0].match(/data-(?:film-name|item-name)="([^"]*)"/)?.[1];
    films.push({ slug, title: decode(name ?? slug.replace(/-/g, ' ')) });
  }
  return { films, hasNext: /class="next"/.test(html) };
}

/** The username comes from the account's saved config, never from the caller. */
function userOf(account: AccountView): string {
  const name = String(account.config?.username ?? account.identity ?? '').trim();
  if (!USERNAME.test(name)) throw new Error('letterboxd: this account has no valid username');
  return name;
}

async function page(ctx: CallContext, path: string): Promise<string> {
  const r = await ctx.fetch({ url: `${ORIGIN}${path}`, headers: HEADERS });
  if (r.status < 200 || r.status >= 300) throw new Error(`letterboxd: ${path} returned ${r.status}`);
  return r.text;
}

export const letterboxd: AccountTypeDef = {
  type: 'letterboxd',
  icon: LOGO_ICON,
  connect(el: HTMLElement, ctx: ConnectContext) {
    const field = ui.field(el, { label: 'Username', hint: 'Your Letterboxd username. Only your public diary and watchlist are read; no password is needed.' });
    const input = ui.textInput(field.control, { placeholder: 'Username', onInput: () => field.setError(null) });
    ui.button(el, { text: ctx.accountId ? 'Save' : 'Connect', variant: 'primary', onClick: async () => {
      const username = input.value.trim();
      if (!USERNAME.test(username)) return field.setError('Use letters, digits, “-” and “_” only.');
      try {
        await ctx.save({ identity: username, label: `Letterboxd (${username})`, config: { username }, held: ['diary.read', 'watchlist.read'] });
      } catch (e) {
        field.setError(e instanceof Error ? e.message : String(e));
      }
    } });
  },
  methods: {
    async diary(account, ctx, args?: { limit?: number }) {
      const entries = parseDiaryRss(await page(ctx, `/${userOf(account)}/rss/`));
      const n = Math.floor(Number(args?.limit));
      return n >= 1 ? entries.slice(0, n) : entries;
    },
    async watchlist(account, ctx, args?: { maxPages?: number }) {
      const user = userOf(account);
      const max = Math.min(Math.max(Math.floor(Number(args?.maxPages ?? 5)) || 1, 1), 20);
      const films: WatchlistFilm[] = [];
      for (let p = 1; p <= max; p++) {
        const r = parseWatchlist(await page(ctx, `/${user}/watchlist/page/${p}/`));
        films.push(...r.films);
        if (!r.hasNext) break;
      }
      return films;
    },
  },
};

export default class LetterboxdAccountsEntry extends Plugin {
  onload(): void {
    addIcon(LOGO_ICON, LOGO_SVG);
    this.register(() => removeIcon(LOGO_ICON));
    this.registerAccountType(letterboxd);
  }
}
