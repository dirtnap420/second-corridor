// data.js — anchor figures, derived series, milestones, sankey definitions.
// Authored from the project spec. Every figure references a key in SOURCES;
// SOURCES is populated only with citations located and verified in the Phase 0
// citation pass. A figure whose source key is absent from SOURCES must not render.

/* ------------------------------------------------------------------
 * SOURCES — the citation registry. Filled by the Phase 0 citation pass.
 * Each entry: { n (footnote number), title, publisher, url, date, retrieved }
 * ------------------------------------------------------------------ */
export const SOURCES = {};
export const SOURCE_LIST = []; // ordered [1]..[n] for the Sources section

export function registerSources(entries) {
  for (const e of entries) {
    SOURCE_LIST.push(e);
    e.n = SOURCE_LIST.length;
    for (const k of e.keys) SOURCES[k] = e;
  }
}

export function cite(key) {
  return SOURCES[key] ? SOURCES[key].n : null;
}

/* ------------------------------------------------------------------
 * Corridor nodes (lon, lat from the spec; identities cited)
 * ------------------------------------------------------------------ */
export const YEAR_MIN = 2022;
export const YEAR_MAX = 2045;

export const NODES = [
  {
    id: 'stamp',
    name: 'STAMP',
    full: 'Science & Technology Advanced Manufacturing Park',
    lonlat: [-78.388, 43.096],
    county: '36037',
    countyName: 'Genesee',
    src: 'node-stamp',
    activeFrom: 2022,
    plate: 'State-designated advanced-manufacturing megasite, Genesee County. Semiconductor supply-chain tenant base.',
  },
  {
    id: 'rit',
    name: 'RIT',
    full: 'Rochester Institute of Technology',
    lonlat: [-77.674, 43.084],
    county: '36055',
    countyName: 'Monroe',
    hero: true,
    src: 'node-rit',
    activeFrom: 2023,
    plate: 'Microelectronic engineering and the corridor talent base. UPWARDS (2023), EMERGE-MICRO (2024).',
  },
  {
    id: 'clay',
    name: 'CLAY',
    full: 'Micron — White Pine Commerce Park',
    lonlat: [-76.17, 43.18],
    county: '36067',
    countyName: 'Onondaga',
    src: 'node-clay',
    activeFrom: 2022,
    plate: 'Micron megafab campus, four fabs planned. Up to $100B over 20+ years.',
  },
  {
    id: 'marcy',
    name: 'MARCY',
    full: 'Marcy Nanocenter',
    lonlat: [-75.28, 43.17],
    county: '36065',
    countyName: 'Oneida',
    src: 'node-marcy',
    activeFrom: 2022,
    plate: 'Wolfspeed 200mm silicon carbide fab at the Marcy Nanocenter, Oneida County.',
  },
  {
    id: 'albany',
    name: 'ALBANY',
    full: 'Albany NanoTech Complex',
    lonlat: [-73.83, 42.69],
    county: '36001',
    countyName: 'Albany',
    src: 'node-albany',
    activeFrom: 2024,
    plate: 'NY CREATES R&D complex. NSTC EUV Accelerator, $825M federal investment.',
  },
];

/* ------------------------------------------------------------------
 * Milestones — the verified ledger (spec). src keys map into SOURCES.
 * ------------------------------------------------------------------ */
export const MILESTONES = [
  { year: 2022, label: 'CHIPS and Science Act signed', src: ['chips-act-2022'] },
  { year: 2022, label: 'Micron announces up to $100B megafab at Clay', src: ['micron-100b'] },
  { year: 2022, label: '$5.5B Green CHIPS state incentive package', src: ['green-chips-5_5b'] },
  { year: 2023, label: 'UPWARDS launches — RIT one of six US universities', src: ['upwards-2023'] },
  { year: 2024, label: 'EMERGE-MICRO: NSF award to RIT + MCC + FLCC', src: ['emerge-micro-2024'] },
  { year: 2024, label: '$6.1B CHIPS direct funding agreements signed Dec 9', src: ['chips-direct-6_1b', 'chips-direct-8k'] },
  { year: 2025, label: 'NSTC EUV Accelerator operational at Albany ($825M)', src: ['euv-825m', 'euv-operational-2025'] },
  { year: 2026, label: 'Groundbreaking; Fab 1 construction begins', src: ['groundbreaking-2026', 'fab1-construction-2026'] },
  { year: 2027, label: '3,000–4,000 construction workers on site', src: ['constr-3000-4000'] },
  { year: 2028, label: 'Fab 1 structure complete; Fab 2 construction begins', src: ['fab1-2028-fab2'] },
  { year: 2030, label: 'Fab 1 operations; ~$20B invested by decade end', src: ['fab1-ops-2030', 'micron-20b-first-phase'] },
  { year: 2033, label: 'Fab 3', src: ['fab3-2033-fab4-2039'] },
  { year: 2039, label: 'Fab 4', src: ['fab3-2033-fab4-2039'] },
  { year: 2041, label: 'Continuous construction ends', src: ['constr-ends-2041'] },
  { year: 2045, label: 'Full operations: 9,000+ permanent, ~50,000 total NY jobs', src: ['micron-9000-direct', 'micron-50000-total', 'full-ops-2045'] },
];

/* ------------------------------------------------------------------
 * Derived series — rules fixed by the spec. Linear between anchors,
 * nothing else. Labeled in the UI as interpolation, not forecast.
 * ------------------------------------------------------------------ */
function lerpSeries(anchors) {
  // anchors: [[year, value], ...] sorted; returns fn(year) -> value
  return (year) => {
    if (year <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      if (year <= anchors[i][0]) {
        const [x0, y0] = anchors[i - 1];
        const [x1, y1] = anchors[i];
        return y0 + ((year - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return anchors[anchors.length - 1][1];
  };
}

// invest — cumulative capital deployed at Clay ($B). (2022,0) (2030,20) (2045,100)
export const investAt = lerpSeries([
  [2022, 0],
  [2030, 20],
  [2045, 100],
]);

// constr — construction workforce band. (2025,0) ramp to (2027, 3000–4000),
// held flat through 2041, ramp-down to (2042, 0). Ramp-down illustrative.
export const constrLowAt = lerpSeries([
  [2025, 0],
  [2027, 3000],
  [2041, 3000],
  [2042, 0],
]);
export const constrHighAt = lerpSeries([
  [2025, 0],
  [2027, 4000],
  [2041, 4000],
  [2042, 0],
]);

// perm — Micron permanent operational jobs. 0 through 2029; (2029,0)→(2045,9000)
export const permAt = lerpSeries([
  [2029, 0],
  [2045, 9000],
]);

// supply — indirect & induced NY jobs. Derived: cited ~50,000 total − cited 9,000 direct.
export const supplyAt = lerpSeries([
  [2029, 0],
  [2045, 41000],
]);

export const SERIES_LABELS = {
  interpolated: 'INTERPOLATED BETWEEN CITED ANCHORS — NOT A FORECAST',
  constr:
    'LEVEL HELD AT THE ONLY CITED FIGURE THROUGH THE CITED CONTINUOUS-CONSTRUCTION WINDOW; RAMP-DOWN ILLUSTRATIVE.',
  supply: 'DERIVED: CITED ~50,000 TOTAL MINUS CITED 9,000 DIRECT.',
};

export const SERIES_SOURCES = {
  invest: ['micron-100b', 'micron-20b-first-phase'],
  constr: ['constr-3000-4000', 'constr-ends-2041'],
  perm: ['micron-9000-direct', 'fab1-ops-2030', 'full-ops-2045'],
  supply: ['micron-50000-total', 'micron-9000-direct'],
};

/* ------------------------------------------------------------------
 * Capital stack sankey ($B, to scale)
 * ------------------------------------------------------------------ */
// The spec's "6.1 → single agreement, NY share not itemized" framing was
// contradicted in the citation pass: Micron's SEC Form 8-K itemizes the award
// (up to $6.165B total — $4.6B Clay Fabs 1–2, $1.5B Boise ID, up to $65M
// workforce) across two funding agreements signed Dec 9, 2024. The itemized,
// citable version renders. The spec's ~$12M workforce figure was not found in
// any public document and is omitted (README → Decisions).
export const CAPITAL_SANKEY = {
  nodes: [
    { id: 'micron', label: 'Micron private', src: 'micron-100b' },
    { id: 'greenchips', label: 'Green CHIPS (NYS)', src: 'green-chips-5_5b' },
    { id: 'chipsdirect', label: 'CHIPS direct (federal)', src: 'chips-direct-6_1b' },
    { id: 'fedrd', label: 'Federal R&D', src: 'euv-825m' },
    { id: 'clay-campus', label: 'Clay campus' },
    { id: 'boise', label: 'Boise ID fab' },
    { id: 'albany-euv', label: 'Albany EUV' },
    { id: 'workforce', label: 'Workforce programs' },
  ],
  links: [
    { source: 'micron', target: 'clay-campus', value: 100, src: 'micron-100b' },
    { source: 'greenchips', target: 'clay-campus', value: 5.5, src: 'green-chips-5_5b' },
    { source: 'chipsdirect', target: 'clay-campus', value: 4.6, src: 'chips-direct-8k' },
    { source: 'chipsdirect', target: 'boise', value: 1.5, src: 'chips-direct-8k' },
    { source: 'chipsdirect', target: 'workforce', value: 0.065, src: 'chips-direct-8k' },
    { source: 'fedrd', target: 'albany-euv', value: 0.825, src: 'euv-825m' },
  ],
  notes: {
    chipsdirect: 'ONE FINALIZED AWARD (UP TO $6.165B) · TWO FUNDING AGREEMENTS, SIGNED DEC 9 2024',
    greenchips:
      'GREEN CHIPS IS A PERFORMANCE-BASED STATE TAX CREDIT — REALIZED AS MILESTONES ARE MET, NOT DISBURSED UP FRONT.',
  },
};

/* ------------------------------------------------------------------
 * Talent lattice sankey — structure cited, widths illustrative.
 * ------------------------------------------------------------------ */
export const TALENT_SANKEY = {
  label: 'STRUCTURE: PUBLIC RECORD · WIDTHS: ILLUSTRATIVE',
  nodes: [
    { id: 'rit-ueng', label: 'RIT microelectronic & electrical eng.', layer: 0, src: 'node-rit' },
    { id: 'mcc', label: 'Monroe Community College', layer: 0, src: 'emerge-micro-2024' },
    { id: 'flcc', label: 'Finger Lakes Community College', layer: 0, src: 'emerge-micro-2024' },
    { id: 'upwards', label: 'UPWARDS cohort', layer: 0, src: 'upwards-2023' },
    { id: 'emerge', label: 'EMERGE-MICRO pathways', layer: 0, src: 'emerge-micro-2024' },
    { id: 'coops', label: 'Co-ops (48 required weeks at RIT)', layer: 1, src: 'rit-coop-48' },
    { id: 'certs', label: 'Certificates', layer: 1, src: 'emerge-micro-2024' },
    { id: 'apprent', label: 'Apprenticeships / retraining', layer: 1, src: 'emerge-micro-2024' },
    { id: 'micron-clay', label: 'Micron Clay', layer: 2, src: 'node-clay' },
    { id: 'gf', label: 'GlobalFoundries', layer: 2, src: 'ny-88-companies' },
    { id: 'albany-nano', label: 'Albany NanoTech', layer: 2, src: 'node-albany' },
    { id: 'suppliers', label: 'NY supplier base (156+ companies)', layer: 2, src: 'ny-156-companies' },
  ],
  // Illustrative widths — equal-weight pathways, no figures implied.
  links: [
    { source: 'rit-ueng', target: 'coops', value: 3 },
    { source: 'rit-ueng', target: 'certs', value: 1 },
    { source: 'mcc', target: 'certs', value: 2 },
    { source: 'mcc', target: 'apprent', value: 1 },
    { source: 'flcc', target: 'certs', value: 1.5 },
    { source: 'flcc', target: 'apprent', value: 1 },
    { source: 'upwards', target: 'coops', value: 1.5 },
    { source: 'emerge', target: 'certs', value: 1.5 },
    { source: 'emerge', target: 'apprent', value: 1.5 },
    { source: 'coops', target: 'micron-clay', value: 1.5 },
    { source: 'coops', target: 'gf', value: 1 },
    { source: 'coops', target: 'albany-nano', value: 1 },
    { source: 'coops', target: 'suppliers', value: 1 },
    { source: 'certs', target: 'micron-clay', value: 2.5 },
    { source: 'certs', target: 'suppliers', value: 2 },
    { source: 'certs', target: 'gf', value: 1.5 },
    { source: 'apprent', target: 'micron-clay', value: 2 },
    { source: 'apprent', target: 'suppliers', value: 1.5 },
  ],
};

/* ------------------------------------------------------------------
 * Physical-inputs anchors (section 11) — hand-entered cited figures,
 * located and verified in the Phase 3 research pass. Same discipline
 * as the milestones: no citation, no render.
 * ------------------------------------------------------------------ */
export const PHYS_ANCHORS = {
  power: [
    { label: 'Fab 1 ("White Pine Phase 1") · proposed in-service Jun 2026', mw: 480, src: 'nyiso-goldbook' },
    { label: 'Fab 2 · proposed in-service Sep 2030', mw: 576, src: 'nyiso-goldbook' },
  ],
  powerNote:
    'NYISO 2026 GOLD BOOK, TABLE IV-7 (LOAD INTERCONNECTION REQUESTS), ZONE C. SUMMER MW. NO FULL-BUILDOUT MW FIGURE APPEARS IN ANY NYISO DOCUMENT.',
  water: {
    demand: [
      { year: 2029, mgd: 7.85, label: 'Fab 1' },
      { year: 2030, mgd: 17.4, label: 'Fabs 1–2' },
      { year: 2035, mgd: 30.3, label: 'Fabs 1–3' },
      { year: 2041, mgd: 48, label: 'full buildout' },
    ],
    src: 'feis-water',
    permitted: { from: 62.5, to: 93.5, src: 'feis-water' },
    note: 'AVERAGE FRESHWATER USAGE PER FEIS TABLE 3.10-3; OCWA PERMITTED LAKE ONTARIO WITHDRAWAL APPLICATION 62.5 → 93.5 MGD PER FEIS P. 3-286.',
  },
};

/* ------------------------------------------------------------------
 * Comparator fabs (section 09) — announcement anchors, cited
 * ------------------------------------------------------------------ */
export const COMPARATORS = [
  { fips: '36067', name: 'Onondaga, NY', project: 'Micron Clay', announced: '2022-10', src: 'micron-100b', hero: true },
  { fips: '04013', name: 'Maricopa, AZ', project: 'TSMC Phoenix', announced: '2020-05', src: 'ann-tsmc-az' },
  { fips: '39089', name: 'Licking, OH', project: 'Intel New Albany', announced: '2022-01', src: 'ann-intel-oh' },
  { fips: '16001', name: 'Ada, ID', project: 'Micron Boise', announced: '2022-09', src: 'ann-micron-id' },
  { fips: '48491', name: 'Williamson, TX', project: 'Samsung Taylor', announced: '2021-11', src: 'ann-samsung-tx' },
];

/* ------------------------------------------------------------------
 * Installed base (section 05) — context plate figures
 * ------------------------------------------------------------------ */
// The spec's "88 NY semiconductor companies" is the state's April 2022 count of
// establishments; the state's current count is 156+ companies. Both render,
// date-qualified (README → Decisions).
export const INSTALLED_BASE = [
  { value: '88', label: 'NY semiconductor establishments, April 2022', src: 'ny-88-establishments-2022' },
  { value: '156+', label: 'NY semiconductor & supply-chain companies today', src: 'ny-156-companies' },
  { value: '34,000+', label: 'New Yorkers employed by them', src: 'ny-34000-workers' },
  { value: '1,500+', label: 'RIT microelectronic engineering alumni in industry', src: 'rit-1500-alumni' },
  { value: '48', label: 'required co-op weeks, RIT microelectronic eng. BS', src: 'rit-coop-48' },
  { value: 'CLASS 1000', label: 'RIT cleanroom — Semiconductor Nanofabrication Lab', src: 'rit-cleanroom' },
  { value: '150 MM', label: 'wafer size, RIT CMOS line', src: 'rit-150mm' },
];
