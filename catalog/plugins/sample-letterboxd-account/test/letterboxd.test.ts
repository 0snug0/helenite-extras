import { describe, expect, it, vi } from 'vitest';
import { decode, letterboxd, parseDiaryRss, parseWatchlist } from '../src/accounts';

const RSS = `<rss><channel><item><title>Heat - 4.5</title><link>https://letterboxd.com/me/film/heat/</link>
<letterboxd:watchedDate>2026-01-02</letterboxd:watchedDate><letterboxd:rewatch>No</letterboxd:rewatch><letterboxd:filmTitle>Heat</letterboxd:filmTitle>
<letterboxd:filmYear>1995</letterboxd:filmYear><letterboxd:memberRating>4.5</letterboxd:memberRating></item>
<item><title>List</title><link>x</link></item></channel></rss>`;
const WL = (next: boolean) => `<ul><li data-film-slug="alien" data-film-name="Alien"></li><div data-item-slug="/film/the-thing/" data-item-name="The &amp; Thing"></div>${next ? '<a class="next">' : ''}</ul>`;
const account = (over: any = {}) => ({ id: 'a', label: 'L', identity: 'me', provider: 'letterboxd-account:letterboxd', config: { username: 'me' }, ...over });

describe('parsers', () => {
  it('reads diary entries and skips non-film items', () => {
    expect(parseDiaryRss(RSS)).toEqual([{ title: 'Heat', year: 1995, rating: 4.5, watchedDate: '2026-01-02', rewatch: false, link: 'https://letterboxd.com/me/film/heat/' }]);
  });
  it('reads watchlist tiles of both markups and the next-page flag', () => {
    expect(parseWatchlist(WL(true))).toEqual({ films: [{ slug: 'alien', title: 'Alien' }, { slug: 'the-thing', title: 'The & Thing' }], hasNext: true });
  });
});

describe('decode', () => {
  it('handles named and numeric entities', () => {
    expect(decode('Don&#8217;t &#x2019; &#39; &#x27; &amp; &lt;b&gt; &quot;')).toBe('Don\u2019t \u2019 \' \' & <b> "');
    expect(decode('&amp;lt;')).toBe('&lt;');
    expect(decode('&#99999999999;')).toBe('');
  });
});

describe('manifest', () => {
  it('declares its host and capability labels; requests are bounded by the host alone', async () => {
    const m = JSON.parse((await import('node:fs')).readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    const t = m.helenite.accounts.accountTypes[0];
    expect(t.hosts).toEqual(['https://letterboxd.com']);
    expect(t.capabilities.map((c: any) => c.id)).toEqual(['diary.read', 'watchlist.read']);
    expect(t.capabilities.every((c: any) => c.paths === undefined && c.http === undefined)).toBe(true);
  });
});

describe('methods', () => {
  it('diary fetches the user RSS through ctx.fetch', async () => {
    const fetch = vi.fn(async () => ({ status: 200, headers: {}, text: RSS }));
    const r = (await letterboxd.methods.diary(account(), { fetch }, undefined)) as any[];
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://letterboxd.com/me/rss/' }));
    expect(r).toHaveLength(1);
  });
  it('watchlist pages until there is no next link', async () => {
    const fetch = vi.fn(async (req: any) => ({ status: 200, headers: {}, text: WL(req.url.endsWith('/page/1/')) }));
    const r = (await letterboxd.methods.watchlist(account(), { fetch }, undefined)) as any[];
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(r.map((f) => f.slug)).toEqual(['alien', 'the-thing', 'alien', 'the-thing']);
  });
  it('rejects a bad username and a failed request', async () => {
    const fetch = vi.fn(async () => ({ status: 404, headers: {}, text: '' }));
    await expect(letterboxd.methods.diary(account({ config: { username: '../x' }, identity: '../x' }), { fetch }, undefined)).rejects.toThrow('valid username');
    expect(fetch).not.toHaveBeenCalled();
    await expect(letterboxd.methods.diary(account(), { fetch }, undefined)).rejects.toThrow('404');
  });
});

describe('logo', () => {
  it('the type names its logo, a currentColor Simple Icons path', async () => {
    const { letterboxd } = await import('../src/accounts');
    const { LOGO_ICON, LOGO_SVG } = await import('../src/logo');
    expect(letterboxd.icon).toBe(LOGO_ICON);
    expect(LOGO_SVG).toMatch(/^<svg [^>]*viewBox="0 0 24 24"><path fill="currentColor" d="M[^"]+"\/><\/svg>$/);
  });
});
