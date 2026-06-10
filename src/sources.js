// sources.js — the citation registry. Every entry below was located and then
// adversarially verified against the live document in the Phase 0 citation pass
// (retrieved 2026-06-10). A figure whose key is absent here does not render.
//
// Conflicts found in the pass (logged in README → Decisions, flagged to the author):
//   · chips-direct: the award is up to $6.165B, executed Dec 9 2024 as TWO funding
//     agreements ($4.6B Clay Fabs 1–2, $1.5B Boise) plus up to $65M workforce, per
//     Micron's SEC Form 8-K — the "single agreement, NY share not itemized" framing
//     is contradicted by the record, so the itemized version renders instead.
//   · The ~$12M federal workforce figure could not be confirmed in any public
//     document and is omitted; the citable figure is the $65M workforce grant.
//   · "88 NY semiconductor companies" is the April 2022 establishments count;
//     the state's current count is 156+ companies. Both render, date-qualified.
import { registerSources } from './data.js';

const R = '2026-06-10';

registerSources([
  {
    keys: ['micron-100b', 'micron-9000-direct', 'micron-20b-first-phase'],
    title: 'Micron Announces Historic Investment of up to $100 Billion to Build Megafab in Central New York',
    publisher: 'Micron Technology, Inc.',
    url: 'https://www.globenewswire.com/news-release/2022/10/04/2527958/0/en/Micron-Announces-Historic-Investment-of-up-to-100-Billion-to-Build-Megafab-in-Central-New-York.html',
    date: '2022-10-04',
    retrieved: R,
  },
  {
    keys: ['micron-50000-total', 'green-chips-5_5b', 'node-clay'],
    title: 'Hochul, Schumer, McMahon Announce: Micron is Coming to Onondaga County',
    publisher: 'Office of Governor Kathy Hochul',
    url: 'https://www.governor.ny.gov/news/hochul-schumer-mcmahon-announce-micron-coming-onondaga-county-micron-will-invest-unprecedented',
    date: '2022-10-04',
    retrieved: R,
  },
  {
    keys: ['green-chips-structure'],
    title: 'Green CHIPS — Empire State Development',
    publisher: 'Empire State Development, New York State',
    url: 'https://esd.ny.gov/green-chips',
    date: 'current program page',
    retrieved: R,
  },
  {
    keys: ['chips-act-2022'],
    title: 'H.R.4346 — 117th Congress: CHIPS and Science Act (Public Law 117-167)',
    publisher: 'Congress.gov, Library of Congress',
    url: 'https://www.congress.gov/bill/117th-congress/house-bill/4346',
    date: '2022-08-09',
    retrieved: R,
  },
  {
    keys: ['chips-direct-6_1b'],
    title: 'Department of Commerce Awards CHIPS Incentives to Micron for Idaho and New York Projects',
    publisher: 'U.S. Department of Commerce / NIST, CHIPS for America',
    url: 'https://www.nist.gov/news-events/news/2024/12/department-commerce-awards-chips-incentives-micron-idaho-and-new-york',
    date: '2024-12-10',
    retrieved: R,
  },
  {
    keys: ['chips-direct-8k'],
    title: 'Micron Technology, Inc. — Form 8-K: CHIPS direct funding agreements (Award Date December 9, 2024)',
    publisher: 'U.S. Securities and Exchange Commission, EDGAR',
    url: 'https://www.sec.gov/Archives/edgar/data/723125/000110465924127174/tm2430615d1_8k.htm',
    date: '2024-12-09',
    retrieved: R,
  },
  {
    keys: ['upwards-2023'],
    title: 'Growing collaboration advances semiconductor industry',
    publisher: 'Rochester Institute of Technology, RIT News',
    url: 'https://www.rit.edu/news/growing-collaboration-advances-semiconductor-industry',
    date: '2025-01-07',
    retrieved: R,
  },
  {
    keys: ['emerge-micro-2024'],
    title: 'NSF Award #2347157 — EMERGE-MICRO: Empowering Minds through Experiential Learning, Research, and Career Growth Opportunities in Emerging Microelectronics',
    publisher: 'U.S. National Science Foundation',
    url: 'https://www.nsf.gov/awardsearch/showAward?AWD_ID=2347157',
    date: '2024-07-08',
    retrieved: R,
  },
  {
    keys: ['euv-825m'],
    title: "NY CREATES' Albany NanoTech Complex Announced as the First CHIPS for America R&D Flagship Facility and Planned Site for the Estimated $825 Million EUV Accelerator",
    publisher: 'U.S. Department of Commerce / NIST',
    url: 'https://www.nist.gov/news-events/news/2024/10/biden-harris-administration-announces-ny-creates-albany-nanotech-complex',
    date: '2024-10-31',
    retrieved: R,
  },
  {
    keys: ['euv-operational-2025'],
    title: "Natcast Celebrates Grand Opening of NSTC EUV Accelerator at NY CREATES' Albany NanoTech Complex",
    publisher: 'Natcast',
    url: 'https://www.prnewswire.com/news-releases/natcast-celebrates-grand-opening-of-nstc-euv-accelerator-at-ny-creates-albany-nanotech-complex-one-of-three-nstc-flagship-semiconductor-rd-facilities-across-the-country-302504465.html',
    date: '2025-07-14',
    retrieved: R,
  },
  {
    keys: ['groundbreaking-2026'],
    title: 'Micron Celebrates Official Groundbreaking at New York Megafab Site',
    publisher: 'Micron Technology, Inc.',
    url: 'https://www.globenewswire.com/news-release/2026/01/16/3220324/14450/en/Micron-Celebrates-Official-Groundbreaking-at-New-York-Megafab-Site.html',
    date: '2026-01-16',
    retrieved: R,
  },
  {
    keys: ['fab1-construction-2026', 'fab1-2028-fab2', 'fab3-2033-fab4-2039', 'constr-ends-2041', 'full-ops-2045', 'feis-water'],
    title: 'Micron Semiconductor Manufacturing Project, Clay, NY — Final Environmental Impact Statement (EISX-006-55-CPO-001)',
    publisher: 'U.S. Department of Commerce CHIPS Program Office & Onondaga County Industrial Development Agency',
    url: 'https://ongoved.com/wp-content/uploads/2025/11/2025_1105_MicronNY_FEIS_Final.pdf',
    date: '2025-11',
    retrieved: R,
  },
  {
    keys: ['fab1-ops-2030'],
    title: 'Micron NY Final EIS, Appendix B-5: Revised Proposed Project Construction Schedule',
    publisher: 'U.S. Department of Commerce CHIPS Program Office & Onondaga County Industrial Development Agency',
    url: 'https://ongoved.com/wp-content/uploads/2025/11/2025_1105_MicronNY_FEIS_Appendix_A-D.pdf',
    date: '2025-11',
    retrieved: R,
  },
  {
    keys: ['constr-3000-4000'],
    title: 'County Executive McMahon delivers 2026 State of the County address',
    publisher: 'Onondaga County, Office of the County Executive',
    url: 'https://onondaga.gov/communications/2026/03/28/county-executive-mcmahon-delivers-2026-state-of-the-county-address/',
    date: '2026-03-28',
    retrieved: R,
  },
  {
    keys: ['ny-88-establishments-2022'],
    title: "Governor Hochul Announces New Team to Guide State's Strategy to Become the Nation's Leading Hub for Semiconductor R&D and Manufacturing",
    publisher: 'Office of Governor Kathy Hochul',
    url: 'https://www.governor.ny.gov/news/governor-hochul-announces-new-team-guide-states-strategy-become-nations-leading-hub',
    date: '2022-04-22',
    retrieved: R,
  },
  {
    keys: ['ny-34000-workers', 'ny-156-companies'],
    title: 'Semiconductors — Empire State Development',
    publisher: 'Empire State Development, New York State',
    url: 'https://esd.ny.gov/industries/semiconductors',
    date: 'current agency page',
    retrieved: R,
  },
  {
    keys: ['rit-cleanroom', 'rit-coop-48'],
    title: 'Microelectronic Engineering BS — RIT',
    publisher: 'Rochester Institute of Technology',
    url: 'https://www.rit.edu/study/microelectronic-engineering-bs',
    date: 'current program page',
    retrieved: R,
  },
  {
    keys: ['rit-150mm'],
    title: 'Tool Set — Semiconductor Nanofabrication Lab, RIT',
    publisher: 'Rochester Institute of Technology',
    url: 'https://www.rit.edu/nanofab/tool-set',
    date: 'current facility page',
    retrieved: R,
  },
  {
    keys: ['rit-1500-alumni'],
    title: "Computer chip technology aligns with RIT's microelectronic engineering program growth",
    publisher: 'Rochester Institute of Technology, RIT News',
    url: 'https://www.rit.edu/news/computer-chip-technology-aligns-rits-microelectronic-engineering-program-growth',
    date: '2022-04-12',
    retrieved: R,
  },
  {
    keys: ['node-stamp'],
    title: 'Governor Hochul and Majority Leader Schumer Announce Semiconductor Supply Chain Manufacturer Edwards Vacuum to Build $319 Million Facility in Genesee County',
    publisher: 'Office of Governor Kathy Hochul',
    url: 'https://www.governor.ny.gov/news/governor-hochul-and-majority-leader-schumer-announce-major-semiconductor-supply-chain',
    date: '2022-11-02',
    retrieved: R,
  },
  {
    keys: ['node-marcy'],
    title: "Governor Hochul Announces the Grand Opening of Wolfspeed's $1 Billion Silicon Carbide Fabrication Facility in the Mohawk Valley",
    publisher: 'Empire State Development, New York State',
    url: 'https://esd.ny.gov/esd-media-center/press-releases/governor-hochul-announces-grand-opening-wolfspeeds-1-billion-silicon-carbide-fabrication-facility-mohawk-valley',
    date: '2022-04-25',
    retrieved: R,
  },
  {
    keys: ['node-albany'],
    title: "Governor Hochul Announces Grand Opening of NSTC EUV Accelerator at NY CREATES' Albany NanoTech Complex",
    publisher: 'Office of Governor Kathy Hochul',
    url: 'https://www.governor.ny.gov/news/governor-hochul-announces-grand-opening-nstc-euv-accelerator-ny-creates-albany-nanotech',
    date: '2025-07-14',
    retrieved: R,
  },
  {
    keys: ['node-rit'],
    title: 'RIT expands its workforce initiatives for the semiconductor industry',
    publisher: 'Rochester Institute of Technology, RIT News',
    url: 'https://www.rit.edu/news/rit-expands-its-workforce-initiatives-semiconductor-industry',
    date: '2024-07-26',
    retrieved: R,
  },
  {
    keys: ['nyiso-goldbook'],
    title: '2026 Load & Capacity Data Report (Gold Book), Table IV-7: Load Interconnection Requests, p. 132',
    publisher: 'New York Independent System Operator',
    url: 'https://www.nyiso.com/documents/20142/2226333/2026-Gold-Book-Public.pdf',
    date: '2026-04',
    retrieved: R,
  },
]);

// Comparator-fab announcement dates (section 09) — verified in the Phase 0 pass.
registerSources([
  {
    keys: ['ann-tsmc-az'],
    title: 'TSMC Announces Intention to Build and Operate an Advanced Semiconductor Fab in the United States',
    publisher: 'TSMC',
    url: 'https://pr.tsmc.com/english/news/2033',
    date: '2020-05-15',
    retrieved: R,
  },
  {
    keys: ['ann-intel-oh'],
    title: 'Intel Announces Next US Site with Landmark Investment in Ohio',
    publisher: 'Intel Corporation',
    url: 'https://www.intc.com/news-events/press-releases/detail/1521/intel-announces-next-us-site-with-landmark-investment-in',
    date: '2022-01-21',
    retrieved: R,
  },
  {
    keys: ['ann-micron-id'],
    title: 'Micron to Invest $15 Billion in New Idaho Fab, Bringing Leading-Edge Memory Manufacturing to the US',
    publisher: 'Micron Technology, Inc.',
    url: 'https://www.globenewswire.com/news-release/2022/09/01/2508617/0/en/Micron-to-Invest-15-Billion-in-New-Idaho-Fab-Bringing-Leading-Edge-Memory-Manufacturing-to-the-US.html',
    date: '2022-09-01',
    retrieved: R,
  },
  {
    keys: ['ann-samsung-tx'],
    title: 'Samsung Electronics Announces New Advanced Semiconductor Fab Site in Taylor, Texas',
    publisher: 'Samsung Electronics',
    url: 'https://news.samsung.com/global/samsung-electronics-announces-new-advanced-semiconductor-fab-site-in-taylor-texas',
    date: '2021-11-24',
    retrieved: R,
  },
]);
