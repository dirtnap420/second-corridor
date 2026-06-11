// build-pages.mjs — R12 + R22 + R40: generated pages.
//
// changelog.html (repo root, vite input) — rendered from CHANGELOG-DATA.md,
//   newest first; an honest empty state until the first post-launch change.
// public/f/NN.html — per-figure share shims: section-specific OG tags + an
//   instant redirect into /#sNN that preserves any instrument-state hash.
//   Newsrooms share figures, not homepages (R22); cards come from
//   build-og.mjs (R23). Both are build artifacts, gitignored.
// public/feed.xml (R40, subsumes R39) — Atom 1.0 feed of the same changelog
//   blocks, one entry per refresh; the changelog block IS the refresh note.
//   Deterministic: every date comes from the changelog/registry, never the
//   build clock.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSections, latestRetrieved } from './lib/sections.mjs';

const root = new URL('..', import.meta.url);
const SITE = 'https://second-corridor.vercel.app';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ================= changelog.html (R12) ================= */
const clPath = fileURLToPath(new URL('CHANGELOG-DATA.md', root));
let blocks = [];
if (existsSync(clPath)) {
  const md = readFileSync(clPath, 'utf8');
  blocks = md
    .split(/^## /m)
    .slice(1)
    .map((b) => {
      const [head, ...lines] = b.trim().split('\n');
      const items = lines
        .filter((l) => l.startsWith('- '))
        .map((l) =>
          escapeHtml(l.slice(2)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        );
      return { date: head.trim(), items };
    })
    .reverse(); // newest first on the page
}

const baseline = latestRetrieved();
const changelogBody = blocks.length
  ? blocks
      .map(
        (b) => `<h2>${escapeHtml(b.date)}</h2>\n<ul>${b.items
          .map((i) => `<li>${i}</li>`)
          .join('\n')}</ul>`
      )
      .join('\n')
  : `<p class="note">NO PUBLISHED-RECORD CHANGES YET — THE DATA IS THE LAUNCH BASELINE, RETRIEVED ${baseline}. THE WEEKLY REFRESH LOGS EVERY CHANGE HERE; TIMESTAMP-ONLY CHURN NEVER COUNTS AS A CHANGE.</p>`;

const changelogHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Data changelog — The Second Corridor</title>
    <meta name="description" content="Every change to the published record, one block per refresh — the visible heartbeat of the tracker." />
    <link rel="canonical" href="${SITE}/changelog" />
    <link rel="alternate" type="application/atom+xml" title="Data changelog" href="/feed.xml" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="Data changelog — The Second Corridor" />
    <meta property="og:description" content="Every change to the published record, one block per refresh." />
    <meta property="og:url" content="${SITE}/changelog" />
    <meta property="og:image" content="${SITE}/og.png" />
    <link rel="stylesheet" href="/src/pages.css" />
    <script type="module" src="/src/page-meta.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="page">
      <header>
        <p class="eyebrow">The Second Corridor · data changelog</p>
        <h1>Every change to the published record.</h1>
        <nav class="page-nav" aria-label="Page sections">
          <a href="/">← the instrument</a>
          <a href="/methods">methods</a>
          <a href="/decisions">decisions</a>
        </nav>
      </header>
      <main id="main">
        <p>
          One block per refresh that changed the published data — new periods, value
          revisions, suppression flips — generated from the pipeline's diff, newest first.
          Prior states are archived in the
          <a href="https://github.com/dirtnap420/second-corridor/tree/main/data-archive">repository</a>;
          the machine-readable diff of the latest change is
          <a href="/data/changes.json">/data/changes.json</a>.
        </p>
        ${changelogBody}
      </main>
      <footer class="page-footer">
        <span>Built by Alex · <a href="mailto:Alex@ozarkintelligence.com">Alex@ozarkintelligence.com</a></span>
        <span>Code <a href="https://github.com/dirtnap420/second-corridor/blob/main/LICENSE">MIT</a> · content &amp; data <a href="https://github.com/dirtnap420/second-corridor/blob/main/LICENSE-CONTENT.md">CC BY 4.0</a></span>
        <span>rev <span data-fill="rev">—</span> · data refreshed <span data-fill="refreshed">—</span></span>
      </footer>
    </div>
  </body>
</html>
`;
writeFileSync(fileURLToPath(new URL('changelog.html', root)), changelogHtml);

/* ================= public/feed.xml (R40 — Atom 1.0; R39 folds in) ================= */
// One entry per changelog block (newest first). Until the first post-launch
// change there is exactly one entry: the launch baseline. RFC 3339 dates are
// the changelog's own YYYY-MM-DD stamps at T00:00:00Z — no build clock.
const atomDate = (d) => `${d}T00:00:00Z`;
const feedEntries = blocks.length
  ? blocks.map((b) => ({
      date: b.date,
      title: `Data refresh ${b.date}`,
      // items are already entity-escaped text + <strong> markup from the
      // changelog parse; wrap as a list, then escape the whole fragment for
      // Atom content type="html"
      html: `<ul>${b.items.map((i) => `<li>${i}</li>`).join('')}</ul>`,
    }))
  : [
      {
        date: baseline,
        title: 'Launch baseline',
        html: `<p>The published record is the launch baseline, retrieved ${baseline}; future refreshes will appear here.</p>`,
      },
    ];
const feedXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Second Corridor — data changelog</title>
  <subtitle>Every change to the published record of New York's semiconductor buildout.</subtitle>
  <link href="${SITE}/" />
  <link rel="self" type="application/atom+xml" href="${SITE}/feed.xml" />
  <id>${SITE}/</id>
  <updated>${atomDate(feedEntries[0].date)}</updated>
  <author><name>Alex</name></author>
${feedEntries
  .map(
    (e) => `  <entry>
    <id>${SITE}/changelog#${e.date}</id>
    <link href="${SITE}/changelog" />
    <title>${escapeHtml(e.title)}</title>
    <updated>${atomDate(e.date)}</updated>
    <content type="html">${escapeHtml(e.html)}</content>
  </entry>`
  )
  .join('\n')}
</feed>
`;
writeFileSync(fileURLToPath(new URL('public/feed.xml', root)), feedXml);

/* ================= public/f/NN.html (R22) ================= */
const sections = readSections();
mkdirSync(fileURLToPath(new URL('public/f/', root)), { recursive: true });
// F44: the redirect lives in one external script (CSP script-src 'self'
// forbids inline) — the figure number comes from the path itself
writeFileSync(
  fileURLToPath(new URL('public/f/go.js', root)),
  `// /f/NN share-shim redirect — carries any instrument-state hash through
var m = location.pathname.match(/\\/f\\/(\\d{2})/);
var num = m ? m[1] : '01';
var h = location.hash;
location.replace('/' + (h && h.length > 1 ? h + '&f=' + num : '#f=' + num));
`
);
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'self'";
for (const s of sections) {
  const title = escapeHtml(`Fig. ${s.num} — ${s.h2}`);
  const desc = escapeHtml(
    `${s.eyebrow} — from The Second Corridor, tracking New York's semiconductor buildout from public data. Every number cited, estimates labeled.`
  );
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <title>${title} — The Second Corridor</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${SITE}/" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${SITE}/f/${s.num}" />
    <meta property="og:image" content="${SITE}/og/f${s.num}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${SITE}/og/f${s.num}.png" />
    <script src="/f/go.js"></script>
    <noscript><meta http-equiv="refresh" content="0;url=/#${s.id}" /></noscript>
  </head>
  <body>
    <p>Redirecting to <a href="/#${s.id}">figure ${s.num}</a>…</p>
  </body>
</html>
`;
  writeFileSync(fileURLToPath(new URL(`public/f/${s.num}.html`, root)), html);
}

/* ================= sitemap.xml (R16) ================= */
const lastmod = latestRetrieved();
const urls = ['/', '/methods', '/decisions', '/changelog'];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(fileURLToPath(new URL('public/sitemap.xml', root)), sitemap);

console.log(
  `pages written: changelog.html (${blocks.length} block(s)) + feed.xml (${feedEntries.length} entr(y/ies)) + ${sections.length} share shims → public/f/ + sitemap.xml`
);
