// Downloads skill icons from devicon once and saves them as self-hosted tiles
// in assets/icons/, so the README does not depend on any icon service.
//
// Usage: node scripts/build-icons.mjs
// To add an icon, add an entry below (name/variant from https://devicon.dev).

import { mkdir, writeFile } from "node:fs/promises";

const OUT_DIR = new URL("../assets/icons/", import.meta.url);
const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";

const TILE = 48;
const PAD = 9;
const TILE_BG = "#1e2533";
const TILE_BORDER = "#30363d";

// `light: true` repaints near-black logos white so they show on the dark tile.
const ICONS = [
  { name: "javascript", variant: "original" },
  { name: "typescript", variant: "original" },
  { name: "html5", variant: "original" },
  { name: "css3", variant: "original" },
  { name: "python", variant: "original" },
  { name: "csharp", variant: "original" },
  { name: "cplusplus", variant: "original" },
  { name: "dart", variant: "original" },
  { name: "kotlin", variant: "original" },
  { name: "java", variant: "original" },
  { name: "flutter", variant: "original" },
  { name: "androidstudio", variant: "original" },
  { name: "unity", variant: "plain", light: true },
  { name: "unrealengine", variant: "original", light: true },
  { name: "godot", variant: "original" },
  { name: "nextjs", variant: "plain", light: true },
  { name: "react", variant: "original" },
  { name: "django", variant: "plain", light: true },
  { name: "photoshop", variant: "original" },
  { name: "illustrator", variant: "original" },
  { name: "aftereffects", variant: "original" },
  { name: "premierepro", variant: "original" },
  { name: "blender", variant: "original" },
  { name: "arduino", variant: "original" },
  { name: "tensorflow", variant: "original" },
  { name: "pytorch", variant: "original" },
  { name: "pandas", variant: "original", light: true },
  { name: "opencv", variant: "original" },
  { name: "opengl", variant: "plain", light: true },
];

const DARK_FILL = /#(?:000|000000|111|111111|0e1128|092e20|130654|130754|150458|1c1c1c|231f20)\b/gi;

function toTile(svg, { light }) {
  svg = svg.replace(/<\?xml[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) throw new Error("no <svg> root");
  const viewBox = open[0].match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 128 128";
  let inner = svg.slice(open.index + open[0].length, svg.lastIndexOf("</svg>"));

  if (light) {
    inner = inner.replace(DARK_FILL, "#ffffff");
    // Paths with no fill at all default to black; give them white instead.
    inner = `<g fill="#ffffff">${inner}</g>`;
  }

  const size = TILE - PAD * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">
<rect x="0.5" y="0.5" width="${TILE - 1}" height="${TILE - 1}" rx="11" fill="${TILE_BG}" stroke="${TILE_BORDER}"/>
<svg x="${PAD}" y="${PAD}" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });

for (const icon of ICONS) {
  const url = `${DEVICON}/${icon.name}/${icon.name}-${icon.variant}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(new URL(`${icon.name}.svg`, OUT_DIR), toTile(await res.text(), icon));
  console.log("saved", icon.name);
}
