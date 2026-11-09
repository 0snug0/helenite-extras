import { defineConnector, request, type ConnectorContext } from '../sdk';

const ORIGIN = 'https://letterboxd.com';

export interface DiaryEntry { title: string; year: number | null; rating: number | null; watchedDate: string | null; rewatch: boolean; link: string; tmdbId: number | null }
export interface WatchlistFilm { slug: string; title: string }
export interface FilmInfo { title: string; year: number | null; director: string | null; rating: number | null; ratingCount: number | null; url: string }

const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");
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
      tmdbId: num(tag(it, 'tmdb:movieId')),
    }));
}

/** Poster tiles carry `data-film-slug` (older markup `data-target-link="/film/slug/"`) and a name attribute. */
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

export function parseFilmPage(html: string, url: string): FilmInfo | null {
  const m = html.match(/<script type="application\/ld\+json">\s*(?:\/\*\s*<!\[CDATA\[\s*\*\/)?\s*([\s\S]*?)\s*(?:\/\*\s*\]\]>\s*\*\/)?\s*<\/script>/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1]);
    const year = j.releasedEvent?.[0]?.startDate ?? j.dateCreated;
    return {
      title: decode(String(j.name ?? '')),
      year: num(year == null ? null : String(year).slice(0, 4)),
      director: j.director?.[0]?.name ?? null,
      rating: num(j.aggregateRating?.ratingValue == null ? null : String(j.aggregateRating.ratingValue)),
      ratingCount: num(j.aggregateRating?.ratingCount == null ? null : String(j.aggregateRating.ratingCount)),
      url,
    };
  } catch { return null; }
}

export const letterboxd = defineConnector({
  id: 'letterboxd',
  name: 'Letterboxd',
  description: 'Public Letterboxd pages and RSS (no account or key needed). Scraping is best effort: markup can change.',
  secrets: [],
  settings: { LETTERBOXD_USER: { default: '', label: 'Letterboxd username' } },
  hosts: () => [ORIGIN],
  client(ctx: ConnectorContext) {
    const page = async (path: string) => (await request('letterboxd', ctx, { url: `${ORIGIN}${path}`, headers: { Accept: 'text/html,application/xml', 'User-Agent': 'Helenite/0.1 (personal vault app)' } })).text;
    const user = (u?: string) => {
      const name = (u ?? String(ctx.settings.LETTERBOXD_USER ?? '')).trim();
      if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('letterboxd: set LETTERBOXD_USER to a username');
      return name;
    };
    return {
      async getDiary(u?: string): Promise<DiaryEntry[]> { return parseDiaryRss(await page(`/${user(u)}/rss/`)); },
      async getWatchlist(u?: string, maxPages = 10): Promise<WatchlistFilm[]> {
        const out: WatchlistFilm[] = [];
        for (let p = 1; p <= maxPages; p++) {
          const r = parseWatchlist(await page(`/${user(u)}/watchlist/page/${p}/`));
          out.push(...r.films);
          if (!r.hasNext) break;
        }
        return out;
      },
      async getFilm(slug: string): Promise<FilmInfo | null> {
        if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('letterboxd: bad film slug');
        return parseFilmPage(await page(`/film/${slug}/`), `${ORIGIN}/film/${slug}/`);
      },
    };
  },
});
