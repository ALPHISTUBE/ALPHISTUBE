// Generates the GitHub stats + top-languages cards as SVGs (dark and light).
// Runs in GitHub Actions (see .github/workflows/profile.yml) using the
// workflow's own token, so no third-party stats service is involved.
//
// Usage:
//   GITHUB_TOKEN=... GITHUB_USER=ALPHISTUBE node scripts/generate-stats.mjs dist
//   node scripts/generate-stats.mjs dist --sample   # offline preview with fake data

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = process.argv[2] ?? "dist";
const SAMPLE = process.argv.includes("--sample");
const USER = process.env.GITHUB_USER ?? "ALPHISTUBE";
const TOKEN = process.env.GITHUB_TOKEN;

// Generated/vendored languages that would otherwise dominate the chart.
const EXCLUDED_LANGS = new Set(
  (process.env.EXCLUDED_LANGS ?? "ShaderLab,HLSL,GLSL,Jupyter Notebook").split(",").map((s) => s.trim()),
);
const TOP_LANGS = 6;

const THEMES = {
  dark: {
    bg: "#0d1117",
    border: "#30363d",
    text: "#e6edf3",
    muted: "#8b949e",
    track: "#21262d",
    accentA: "#22d3ee",
    accentB: "#a78bfa",
  },
  light: {
    bg: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#59636e",
    track: "#eaeef2",
    accentA: "#0891b2",
    accentB: "#7c3aed",
  },
};

// ---------------------------------------------------------------- data

async function graphql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors ?? body));
  return body.data;
}

async function fetchStats() {
  const { user } = await graphql(
    `query($login: String!) {
      user(login: $login) {
        createdAt
        pullRequests { totalCount }
        issues { totalCount }
        repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
          totalCount
          nodes {
            stargazerCount
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name color } }
            }
          }
        }
        contributionsCollection { totalCommitContributions restrictedContributionsCount }
      }
    }`,
    { login: USER },
  );

  // The contribution calendar is limited to one year per query, so alias one
  // collection per year since the account was created.
  const firstYear = new Date(user.createdAt).getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  const years = [];
  for (let y = firstYear; y <= thisYear; y++) years.push(y);
  const yearFields = years
    .map(
      (y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }`,
    )
    .join("\n");
  const { user: cal } = await graphql(`query($login: String!) { user(login: $login) { ${yearFields} } }`, {
    login: USER,
  });

  const days = years
    .flatMap((y) => cal[`y${y}`].contributionCalendar.weeks.flatMap((w) => w.contributionDays))
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalContributions = years.reduce((n, y) => n + cal[`y${y}`].contributionCalendar.totalContributions, 0);

  const langBytes = new Map();
  for (const repo of user.repositories.nodes) {
    for (const { size, node } of repo.languages.edges) {
      if (EXCLUDED_LANGS.has(node.name)) continue;
      const prev = langBytes.get(node.name) ?? { size: 0, color: node.color ?? "#8b949e" };
      prev.size += size;
      langBytes.set(node.name, prev);
    }
  }

  return {
    totalContributions,
    ...streaks(days),
    commitsThisYear:
      user.contributionsCollection.totalCommitContributions + user.contributionsCollection.restrictedContributionsCount,
    pullRequests: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    stars: user.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
    repos: user.repositories.totalCount,
    languages: [...langBytes].map(([name, v]) => ({ name, ...v })),
  };
}

function streaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  const past = days.filter((d) => d.date <= today);

  let longest = 0;
  let run = 0;
  for (const d of past) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // Today not having contributions yet shouldn't break the current streak.
  let i = past.length - 1;
  if (i >= 0 && past[i].date === today && past[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && past[i].contributionCount > 0; i--) current++;

  return { currentStreak: current, longestStreak: longest };
}

const SAMPLE_STATS = {
  totalContributions: 1284,
  currentStreak: 6,
  longestStreak: 41,
  commitsThisYear: 312,
  pullRequests: 27,
  issues: 9,
  stars: 14,
  repos: 21,
  languages: [
    { name: "JavaScript", size: 900, color: "#f1e05a" },
    { name: "C#", size: 600, color: "#178600" },
    { name: "Python", size: 420, color: "#3572A5" },
    { name: "HTML", size: 300, color: "#e34c26" },
    { name: "CSS", size: 200, color: "#663399" },
    { name: "Kotlin", size: 120, color: "#A97BFF" },
    { name: "GDScript", size: 60, color: "#355570" },
  ],
};

// ---------------------------------------------------------------- render

const W = 440;
const H = 210;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : n.toLocaleString("en-US"));

function card(t, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${t.accentA}"/><stop offset="1" stop-color="${t.accentB}"/>
  </linearGradient>
</defs>
<style>
  text { font-family: ${FONT}; }
  .title { font-size: 15px; font-weight: 600; fill: ${t.text}; }
  .big { font-size: 26px; font-weight: 700; fill: ${t.text}; }
  .value { font-size: 15px; font-weight: 600; fill: ${t.text}; }
  .label { font-size: 11.5px; font-weight: 400; fill: ${t.muted}; }
  .fade { animation: fade .5s ease-out backwards; }
  @keyframes fade { from { opacity: 0; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<rect x="24" y="22" width="4" height="16" rx="2" fill="url(#accent)"/>
<text x="36" y="35" class="title">${esc(title)}</text>
${body}
</svg>
`;
}

function statsCard(s, t) {
  const big = [
    ["Contributions", fmt(s.totalContributions), "all time"],
    ["Current streak", fmt(s.currentStreak), s.currentStreak === 1 ? "day" : "days"],
    ["Longest streak", fmt(s.longestStreak), s.longestStreak === 1 ? "day" : "days"],
  ];
  const small = [
    ["Commits (yr)", s.commitsThisYear],
    ["Pull requests", s.pullRequests],
    ["Issues", s.issues],
    ["Stars", s.stars],
  ];
  const colW = (W - 48) / 3;
  const smallW = (W - 48) / 4;

  const bigSvg = big
    .map(
      ([label, value, unit], i) => `<g class="fade" style="animation-delay:${i * 120}ms" transform="translate(${24 + i * colW} 62)">
  <text y="0" class="label">${label}</text>
  <text y="34" class="big">${value}<tspan dx="7" class="label">${unit}</tspan></text>
</g>`,
    )
    .join("\n");

  const smallSvg = small
    .map(
      ([label, value], i) => `<g class="fade" style="animation-delay:${360 + i * 80}ms" transform="translate(${24 + i * smallW} 154)">
  <text y="0" class="value">${fmt(value)}</text>
  <text y="20" class="label">${label}</text>
</g>`,
    )
    .join("\n");

  return card(
    t,
    "GitHub Stats",
    `${bigSvg}
<line x1="24" x2="${W - 24}" y1="122" y2="122" stroke="${t.border}"/>
${smallSvg}`,
  );
}

function langsCard(s, t) {
  const sorted = [...s.languages].sort((a, b) => b.size - a.size);
  const total = sorted.reduce((n, l) => n + l.size, 0) || 1;
  const top = sorted.slice(0, TOP_LANGS);
  const restSize = sorted.slice(TOP_LANGS).reduce((n, l) => n + l.size, 0);
  if (restSize > 0) top.push({ name: "Other", size: restSize, color: t.muted });

  const barX = 24;
  const barW = W - 48;
  let x = barX;
  const segments = top
    .map((l) => {
      const w = (l.size / total) * barW;
      const seg = `<rect x="${x.toFixed(2)}" y="58" width="${Math.max(w, 0).toFixed(2)}" height="10" fill="${l.color}"/>`;
      x += w;
      return seg;
    })
    .join("");

  const colW = barW / 2;
  const legend = top
    .map((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const pct = ((l.size / total) * 100).toFixed(1);
      return `<g class="fade" style="animation-delay:${i * 70}ms" transform="translate(${barX + col * colW} ${96 + row * 28})">
  <circle cx="5" cy="-4" r="5" fill="${l.color}"/>
  <text x="18" y="0" class="value" style="font-size:13px">${esc(l.name)}</text>
  <text x="${colW - 20}" y="0" class="label" text-anchor="end">${pct}%</text>
</g>`;
    })
    .join("\n");

  return card(
    t,
    "Top Languages",
    `<clipPath id="bar"><rect x="${barX}" y="58" width="${barW}" height="10" rx="5"/></clipPath>
<rect x="${barX}" y="58" width="${barW}" height="10" rx="5" fill="${t.track}"/>
<g clip-path="url(#bar)">${segments}</g>
${legend || `<text x="${barX}" y="110" class="label">No language data yet</text>`}`,
  );
}

// ---------------------------------------------------------------- main

if (!SAMPLE && !TOKEN) {
  console.error("GITHUB_TOKEN is required (or pass --sample for fake data).");
  process.exit(1);
}

const stats = SAMPLE ? SAMPLE_STATS : await fetchStats();
await mkdir(OUT_DIR, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(join(OUT_DIR, `stats-${name}.svg`), statsCard(stats, theme));
  await writeFile(join(OUT_DIR, `langs-${name}.svg`), langsCard(stats, theme));
}
console.log(`Wrote cards for ${USER} to ${OUT_DIR}/`, SAMPLE ? "(sample data)" : JSON.stringify({ ...stats, languages: undefined }));
