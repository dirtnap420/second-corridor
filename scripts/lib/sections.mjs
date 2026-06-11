// sections.mjs — parse the numbered sections out of index.html so the share
// pages (R22) and per-section OG cards (R23) can never drift from the page's
// actual eyebrows and headlines. Returns [{num:'01', id:'s01', eyebrow, h2}].
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function readSections() {
  const html = readFileSync(
    fileURLToPath(new URL('../../index.html', import.meta.url)),
    'utf8'
  );
  const out = [];
  const re =
    /<section class="sheet col" id="(s(\d{2}))"[\s\S]*?<p class="eyebrow">([\s\S]*?)<\/p>[\s\S]*?<h2 id="h\d{2}">([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ id: m[1], num: m[2], eyebrow: decode(m[3]), h2: decode(m[4]) });
  }
  if (out.length < 12) {
    throw new Error(`sections.mjs parsed only ${out.length} sections from index.html — markup drift?`);
  }
  return out;
}

export function latestRetrieved() {
  const reg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../public/data/sources.json', import.meta.url)), 'utf8')
  );
  return reg.sources.map((s) => s.retrieved).filter(Boolean).sort().pop();
}
