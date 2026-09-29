#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { DEFAULT_OPTIONS, testRobots, type RobotsReport } from './robots.js'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

function collect(value: string, prev: string[]): string[] {
  return [...prev, value]
}

const program = new Command()
program
  .name('robots-txt-tester')
  .description('Fetch a site’s robots.txt, lint it, and test which URLs each crawler may fetch.')
  .version(version)
  .argument('<site>', 'site URL (or its robots.txt URL)')
  .option('-u, --url <path>', 'URL or path to test (repeatable; default /)', collect, [])
  .option('-a, --agent <token>', 'user-agent token to test as (repeatable; default *, Googlebot, Bingbot)', collect, [])
  .option('--expect-allowed', 'fail if any tested URL is blocked for any tested agent (CI guard for staging→production)', false)
  .option('--no-check-sitemaps', 'do not HEAD the Sitemap: URLs')
  .option('--timeout <ms>', 'per-request timeout', String(DEFAULT_OPTIONS.timeoutMs))
  .option('--json', 'JSON output', false)
  .option('--fail-on <level>', '"error" (default), "warning", or "none"', 'error')
  .action(async (site: string, opts) => {
    if (!['error', 'warning', 'none'].includes(opts.failOn)) {
      console.error('--fail-on must be error, warning or none')
      process.exitCode = 2
      return
    }
    const report = await testRobots(site, {
      ...DEFAULT_OPTIONS,
      urls: opts.url.length > 0 ? opts.url : DEFAULT_OPTIONS.urls,
      agents: opts.agent.length > 0 ? opts.agent : DEFAULT_OPTIONS.agents,
      expectAllowed: Boolean(opts.expectAllowed),
      checkSitemaps: opts.checkSitemaps !== false,
      timeoutMs: Number(opts.timeout) || DEFAULT_OPTIONS.timeoutMs
    })
    if (opts.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    else process.stdout.write(render(report))
    const errors = report.findings.filter((x) => x.severity === 'error').length
    const warnings = report.findings.length - errors
    console.error(`\n${errors} error(s), ${warnings} warning(s).`)
    if ((opts.failOn === 'error' && errors > 0) || (opts.failOn === 'warning' && report.findings.length > 0)) process.exitCode = 1
  })

export function render(r: RobotsReport): string {
  const lines = [`${r.robotsUrl}`, `  HTTP ${r.status ?? 'none'}${r.fetchError ? ` (${r.fetchError})` : ''}, ${(r.bytes / 1024).toFixed(1)} KiB, ${r.groups.length} group(s), ${r.sitemaps.length} sitemap(s)`]
  for (const g of r.groups) lines.push(`  line ${g.line}: User-agent ${g.agents.join(', ')} — ${g.rules} rule(s)`)
  for (const s of r.sitemaps) lines.push(`  Sitemap: ${s}`)
  if (r.verdicts.length > 0) {
    lines.push('')
    for (const v of r.verdicts) lines.push(`  ${v.allowed ? '✓ allowed' : '✗ BLOCKED'}  ${v.agent.padEnd(10)} ${v.url}${v.line ? `  (line ${v.line})` : ''}`)
  }
  if (r.findings.length > 0) lines.push('')
  for (const x of r.findings) lines.push(`  ${x.severity === 'error' ? '✗' : '!'} ${x.code}${x.line ? ` (line ${x.line})` : ''}: ${x.message}`)
  return lines.join('\n') + '\n'
}

program.parseAsync(process.argv)
