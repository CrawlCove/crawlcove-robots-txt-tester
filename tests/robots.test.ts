import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, lint, testRobots } from '../src/robots.js'
import { FixtureServer } from './fixtureServer.js'

const codes = (r: { findings: Array<{ code: string }> }) => r.findings.map((x) => x.code)

describe('lint (pure)', () => {
  it('passes a sensible WordPress robots.txt', () => {
    const r = lint('User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://a.test/sitemap.xml\n')
    expect(r.findings).toEqual([])
    expect(r.groups).toEqual([{ agents: ['*'], rules: 2, line: 1 }])
    expect(r.sitemaps).toEqual([{ url: 'https://a.test/sitemap.xml', line: 5 }])
  })

  it('flags Disallow: / for everyone as blocks-everything with its line number', () => {
    const r = lint('# staging\nUser-agent: *\nDisallow: /\n')
    expect(r.findings.map((x) => [x.code, x.line])).toEqual([['blocks-everything', 3], ['no-sitemap', undefined]])
  })

  it('does not call a per-bot Disallow: / a site-wide block', () => {
    const r = lint('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://a.test/s.xml\n')
    expect(codes(r)).toEqual([])
  })

  it('catches rules before any group, unknown and unsupported directives, relative sitemaps, duplicate groups, asset blocks and the wp-admin-ajax trap', () => {
    const r = lint(['Disallow: /early', 'User-agent: *', 'Disallow: /wp-admin/', 'Disallow: /wp-content/', 'Noindex: /x', 'Crawl-delay: 10', 'Foo: bar', 'this is not a directive', 'Sitemap: /sitemap.xml', 'User-agent: *', 'Allow: /'].join('\n'))
    expect(codes(r).sort()).toEqual(['blocks-assets', 'crawl-delay', 'duplicate-agent-group', 'noindex-directive', 'rule-without-agent', 'sitemap-relative', 'unknown-directive', 'unknown-directive', 'wp-admin-ajax'].sort())
    expect(r.findings.find((x) => x.code === 'rule-without-agent')?.line).toBe(1)
  })

  it('treats consecutive User-agent lines as one group', () => {
    const r = lint('User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /private/\nSitemap: https://a.test/s.xml\n')
    expect(r.groups).toEqual([{ agents: ['Googlebot', 'Bingbot'], rules: 1, line: 1 }])
  })
})

describe('testRobots over HTTP', () => {
  let server: FixtureServer
  afterEach(async () => server.close())
  const opts = { ...DEFAULT_OPTIONS, timeoutMs: 3000 }

  it('evaluates URLs per agent with the deciding line, and HEADs the sitemaps', async () => {
    server = new FixtureServer({})
    const base = await server.listen()
    server.set({
      '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: `User-agent: *\nDisallow: /private/\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: ${base}/sitemap.xml\nSitemap: ${base}/missing.xml\n` },
      '/sitemap.xml': { headers: { 'content-type': 'application/xml' }, body: '<urlset/>' }
    })
    const r = await testRobots(base, { ...opts, urls: ['/', '/private/x'], agents: ['*', 'Googlebot'] })
    expect(r.status).toBe(200)
    expect(r.verdicts).toEqual([
      { url: `${base}/`, agent: '*', allowed: true, line: null },
      { url: `${base}/`, agent: 'Googlebot', allowed: true, line: 5 },
      { url: `${base}/private/x`, agent: '*', allowed: false, line: 2 },
      { url: `${base}/private/x`, agent: 'Googlebot', allowed: true, line: 5 }
    ])
    expect(codes(r)).toEqual(['sitemap-not-found'])
    expect(r.findings[0].message).toContain('missing.xml returns HTTP 404')
  })

  it('--expect-allowed turns a blocked test URL into an error', async () => {
    server = new FixtureServer({ '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /\nSitemap: https://a.test/s.xml\n' } })
    const base = await server.listen()
    const r = await testRobots(base, { ...opts, checkSitemaps: false, expectAllowed: true, agents: ['*'] })
    expect(codes(r).sort()).toEqual(['blocks-everything', 'url-blocked'])
  })

  it('a 404 robots.txt is allow-all with a nudge; a 500 is a hard error; HTML is not-text', async () => {
    server = new FixtureServer({})
    const base = await server.listen()
    const none = await testRobots(base, { ...opts, agents: ['*'] })
    expect(none.status).toBe(404)
    expect(codes(none)).toEqual(['no-sitemap'])
    expect(none.verdicts[0].allowed).toBe(true)
    server.set({ '/robots.txt': { status: 503, body: 'down' } })
    expect(codes(await testRobots(base, opts))).toEqual(['server-error'])
    server.set({ '/robots.txt': { headers: { 'content-type': 'text/html' }, body: '<!doctype html><html><body>404</body></html>' } })
    expect(codes(await testRobots(base, opts))).toEqual(['not-text'])
  })

  it('reports an unreachable host as fetch-error', async () => {
    server = new FixtureServer({})
    const base = await server.listen()
    await server.close()
    server = new FixtureServer({})
    await server.listen()
    const r = await testRobots(base, { ...opts, timeoutMs: 2000 })
    expect(codes(r)).toEqual(['fetch-error'])
  })
})
