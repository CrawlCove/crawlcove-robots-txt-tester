# Changelog

## 1.0.0 — 2026-09-29

Initial release.

- `robots-txt-tester <site>`: fetches `/robots.txt`, lints it line by line,
  tests URLs (`-u`, repeatable) as user agents (`-a`, default `*`, Googlebot,
  Bingbot) with the same robots-parser the Crawl Cove crawler uses, and
  reports the deciding line for each verdict.
- Findings: `fetch-error`, `server-error` (Google stops crawling on 5xx),
  `not-text`, `too-large` (500 KiB), `redirected-off-host`,
  `blocks-everything`, `rule-without-agent`, `unknown-directive`,
  `noindex-directive`, `crawl-delay`, `sitemap-relative`,
  `sitemap-not-found` (Sitemap: URLs are HEADed), `no-sitemap`,
  `duplicate-agent-group`, `blocks-assets`, `wp-admin-ajax`, and
  `url-blocked` with `--expect-allowed`.
- `--fail-on error|warning|none`, `--json`, `--no-check-sitemaps`.
