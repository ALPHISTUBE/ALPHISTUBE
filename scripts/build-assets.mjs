// Builds the animated header banner and the contact buttons into assets/.
// Everything is plain SVG + CSS, committed to the repo, so nothing can go
// offline. Edit the text below and re-run: node scripts/build-assets.mjs

import { mkdir, writeFile } from "node:fs/promises";

const OUT_DIR = new URL("../assets/", import.meta.url);

const NAME = "Rafawat Sholaiman Alphi";
const GREETING = "Hi there, I'm";
const ROLES = ["Software Developer", "Game Developer", "Web & Mobile Developer", "ML & Computer Vision Tinkerer"];

const THEMES = {
  dark: {
    bgA: "#0d1117",
    bgB: "#161b22",
    border: "#30363d",
    text: "#e6edf3",
    muted: "#8b949e",
    orbit: "#30363d",
    accentA: "#22d3ee",
    accentB: "#a78bfa",
  },
  light: {
    bgA: "#ffffff",
    bgB: "#f6f8fa",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#59636e",
    orbit: "#d0d7de",
    accentA: "#0891b2",
    accentB: "#7c3aed",
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SANS =`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

// ---------------------------------------------------------------- banner

function banner(t) {
  const W = 1200;
  const H = 300;
  const roleX = 64;
  const roleY = 214;
  const charW = 13; // textLength pins each role to exactly this per character
  const slot = 3.6; // seconds each role is on screen
  const total = slot * ROLES.length;

  // Each role types in, holds, then deletes, inside its own slot of the cycle.
  // A clip rect slides right in character-sized steps to reveal the text, and
  // the cursor slides with it.
  const pct = (s) => ((s / total) * 100).toFixed(3);
  const roles = ROLES.map((role, i) => {
    const w = role.length * charW;
    const start = i * slot;
    const typed = start + 1.2;
    const held = start + slot - 0.7;
    const gone = start + slot - 0.1;
    const steps = role.length;
    const kf = (name, prop) => `@keyframes ${name}${i} {
  0%${start > 0 ? `, ${pct(start - 0.01)}%` : ""} { ${prop(0, 0)}; }
  ${pct(start)}% { ${prop(0, 1)}; animation-timing-function: steps(${steps}, end); }
  ${pct(typed)}% { ${prop(w, 1)}; }
  ${pct(held)}% { ${prop(w, 1)}; animation-timing-function: steps(${steps}, end); }
  ${pct(gone)}% { ${prop(0, 1)}; }
  ${pct(gone + 0.01)}%, 100% { ${prop(0, 0)}; }
}`;
    return {
      css: `${kf("reveal", (x) => `transform: translateX(${x.toFixed(1)}px)`)}
${kf("cursor", (x, o) => `transform: translateX(${x.toFixed(1)}px); opacity: ${o}`)}
.clip${i} { animation: reveal${i} ${total}s infinite; }
.cur${i} { opacity: 0; animation: cursor${i} ${total}s infinite; }`,
      svg: `<clipPath id="clip${i}"><rect class="clip${i}" x="${roleX - w}" y="${roleY - 26}" width="${w}" height="36"/></clipPath>
<text x="${roleX}" y="${roleY}" class="role" clip-path="url(#clip${i})" textLength="${w.toFixed(1)}" lengthAdjust="spacing">${esc(role)}</text>
<rect class="cur${i}" x="${roleX + 2}" y="${roleY - 20}" width="3" height="26" rx="1" fill="${t.accentA}"/>`,
    };
  });

  const cx = 1010;
  const cy = 150;
  const orbits = [
    { r: 58, dur: 9, dot: 5, phase: 0.1 },
    { r: 92, dur: 15, dot: 6, phase: 0.45, reverse: true },
    { r: 126, dur: 24, dot: 4, phase: 0.75 },
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${NAME}: ${ROLES.join(", ")}`)}">
<title>${esc(NAME)}</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${t.bgA}"/><stop offset="1" stop-color="${t.bgB}"/>
  </linearGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${t.accentA}"/><stop offset="1" stop-color="${t.accentB}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${t.accentB}" stop-opacity="0.22"/><stop offset="1" stop-color="${t.accentB}" stop-opacity="0"/>
  </radialGradient>
  <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill="${t.orbit}"/>
  </pattern>
</defs>
<style>
  .greet { font: 500 22px ${SANS}; fill: ${t.muted}; }
  .name { font: 800 56px ${SANS}; letter-spacing: -1px; }
  .role { font: 600 22px ${MONO}; fill: ${t.text}; }
  .prompt { font: 600 22px ${MONO}; fill: ${t.accentA}; }
  .rise { animation: rise .8s ease-out backwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .spin { transform-origin: ${cx}px ${cy}px; animation: spin linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pulse { transform-origin: ${cx}px ${cy}px; animation: pulse 4s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.12); } }
  ${roles.map((r) => r.css).join("\n  ")}
  @media (prefers-reduced-motion: reduce) { .rise, .spin, .pulse { animation: none; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="url(#bg)" stroke="${t.border}"/>
<rect x="760" y="1" width="439" height="${H - 2}" fill="url(#dots)" opacity="0.7"/>

<circle cx="${cx}" cy="${cy}" r="150" fill="url(#glow)" class="pulse"/>
${orbits
  .map(
    (o) => `<circle cx="${cx}" cy="${cy}" r="${o.r}" fill="none" stroke="${t.orbit}" stroke-dasharray="${o.reverse ? "4 6" : "none"}"/>
<g class="spin" style="animation-duration:${o.dur}s;animation-delay:-${(o.dur * o.phase).toFixed(1)}s;${o.reverse ? "animation-direction:reverse;" : ""}">
  <circle cx="${cx + o.r}" cy="${cy}" r="${o.dot}" fill="url(#accent)"/>
</g>`,
  )
  .join("\n")}
<g transform="translate(${cx} ${cy})">
  <rect x="-30" y="-30" width="60" height="60" rx="16" fill="url(#accent)"/>
  <text x="0" y="9" text-anchor="middle" style="font: 700 26px ${MONO}; fill: #ffffff;">&lt;/&gt;</text>
</g>

<g class="rise"><text x="64" y="104" class="greet">${esc(GREETING)}</text></g>
<g class="rise" style="animation-delay:.15s"><text x="62" y="168" class="name" fill="url(#accent)">${esc(NAME)}</text></g>
<g class="rise" style="animation-delay:.3s">
  <text x="${roleX - 30}" y="${roleY}" class="prompt">›</text>
  ${roles.map((r) => r.svg).join("\n  ")}
</g>
<rect x="64" y="244" width="72" height="4" rx="2" fill="url(#accent)" class="rise" style="animation-delay:.45s"/>
</svg>
`;
}

// ---------------------------------------------------------------- buttons

// Simple Icons paths (CC0), 24x24 viewBox.
const GLYPHS = {
  mail: "M1.5 4.5h21A1.5 1.5 0 0 1 24 6v12a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 0 18V6a1.5 1.5 0 0 1 1.5-1.5Zm.75 2.56v.31l9.75 6.5 9.75-6.5v-.31L12 13.13 2.25 7.06Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

function button(label, glyph, color) {
  const W = 34 + label.length * 8.4 + 18;
  const H = 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H}" viewBox="0 0 ${W.toFixed(0)} ${H}" role="img" aria-label="${label}">
<rect width="100%" height="100%" rx="8" fill="${color}"/>
<g transform="translate(14 10) scale(0.667)"><path fill="#ffffff" d="${GLYPHS[glyph]}"/></g>
<text x="38" y="23" style="font: 600 14px ${SANS}; fill: #ffffff;">${label}</text>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(new URL(`banner-${name}.svg`, OUT_DIR), banner(theme));
}
await writeFile(new URL("btn-email.svg", OUT_DIR), button("rsalphi@gmail.com", "mail", "#c5221f"));
await writeFile(new URL("btn-linkedin.svg", OUT_DIR), button("LinkedIn", "linkedin", "#0a66c2"));
console.log("Wrote banner and buttons to assets/");
