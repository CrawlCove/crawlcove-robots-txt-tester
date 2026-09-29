export type Severity = 'error' | 'warning';
export type FindingCode = 'fetch-error' | 'server-error' | 'not-text' | 'too-large' | 'redirected-off-host' | 'blocks-everything' | 'rule-without-agent' | 'unknown-directive' | 'noindex-directive' | 'crawl-delay' | 'sitemap-relative' | 'sitemap-not-found' | 'no-sitemap' | 'duplicate-agent-group' | 'blocks-assets' | 'wp-admin-ajax' | 'url-blocked';
export declare const SEVERITY: Record<FindingCode, Severity>;
export interface Finding {
    code: FindingCode;
    severity: Severity;
    message: string;
    line?: number;
}
export interface UrlVerdict {
    url: string;
    agent: string;
    allowed: boolean;
    /** 1-based line of the rule that decided it, or null when no rule matched (allowed by default). */
    line: number | null;
}
export interface RobotsReport {
    robotsUrl: string;
    status: number | null;
    fetchError: string | null;
    bytes: number;
    /** Present when the file was fetched and is text. */
    body: string | null;
    groups: Array<{
        agents: string[];
        rules: number;
        line: number;
    }>;
    sitemaps: string[];
    findings: Finding[];
    verdicts: UrlVerdict[];
}
export interface Options {
    timeoutMs: number;
    userAgent: string;
    /** URLs (absolute or path) to test. Default: "/". */
    urls: string[];
    /** User-agent tokens to test each URL as. */
    agents: string[];
    /** Treat a blocked test URL as a failing finding. */
    expectAllowed: boolean;
    /** HEAD each Sitemap: URL (capped at 10). */
    checkSitemaps: boolean;
    fetch?: typeof fetch;
}
export declare const DEFAULT_OPTIONS: Options;
/** Pure: lint the text of a robots.txt. */
export declare function lint(body: string): {
    findings: Finding[];
    groups: RobotsReport['groups'];
    sitemaps: Array<{
        url: string;
        line: number;
    }>;
};
/** Fetch + lint + evaluate. `input` may be a site URL or the robots.txt URL itself. */
export declare function testRobots(input: string, opts?: Options): Promise<RobotsReport>;
