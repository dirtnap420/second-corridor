// live-sources.js — the live datasets' citation metadata, shared between the
// runtime registration (live.js) and the build-time registry export
// (scripts/build-sources.mjs → public/data/sources.json, P32). Data-only:
// no DOM, importable in node. `dataset` names the public/data/<dataset>.json
// file whose provenance supplies date/retrieved at join time. Order here IS
// footnote order for the live block — append only, or old posters renumber.
export const LIVE_SOURCE_DEFS = [
  {
    key: 'qcew-data',
    dataset: 'qcew',
    title: 'Quarterly Census of Employment and Wages — NAICS 3344, corridor counties',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/cew/',
  },
  {
    key: 'oews-data',
    dataset: 'oews',
    title: 'Occupational Employment and Wage Statistics — metro wage files',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/oes/',
  },
  {
    key: 'ipeds-data',
    dataset: 'ipeds',
    title: 'IPEDS completions by 6-digit CIP (via Urban Institute Education Data API)',
    publisher: 'NCES / Urban Institute',
    url: 'https://educationdata.urban.org/',
  },
  {
    key: 'lodes-data',
    dataset: 'lodes',
    title: 'LEHD LODES8 origin–destination employment (NY main + aux, JT00)',
    publisher: 'U.S. Census Bureau',
    url: 'https://lehd.ces.census.gov/data/',
  },
  {
    key: 'usaspending-data',
    dataset: 'spending',
    title: 'USAspending.gov award records (CHIPS Incentives CFDA 11.037; NSF assistance)',
    publisher: 'U.S. Department of the Treasury',
    url: 'https://www.usaspending.gov/',
  },
  {
    key: 'bps-data',
    dataset: 'permits',
    title: 'Building Permits Survey, annual county files',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/construction/bps/',
  },
  {
    key: 'acs-data',
    dataset: 'acs',
    title: 'American Community Survey 5-year estimates, table B15003 (educational attainment)',
    publisher: 'U.S. Census Bureau',
    url: 'https://www.census.gov/programs-surveys/acs',
  },
  {
    key: 'nyiso-data',
    dataset: 'nyiso',
    title: 'NYISO integrated real-time actual load by zone (palIntegrated), Zone C',
    publisher: 'New York Independent System Operator',
    url: 'http://mis.nyiso.com/public/',
  },
];
