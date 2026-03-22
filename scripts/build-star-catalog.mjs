/**
 * Generates a trimmed star catalog (mag <= 6.5) from the Hipparcos catalog
 * available via VizieR / CDS. The output is a compact JSON array written to
 * public/stars.json, ready for the browser.
 *
 * Usage:  node scripts/build-star-catalog.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "public", "stars.json");
const MAG_LIMIT = 6.5;

// Hipparcos catalog via VizieR -- _RAJ2000 and _DEJ2000 are computed decimal
// degree columns that VizieR always returns as plain floats.
const VIZIER_URL =
  "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?" +
  "-source=I/239/hip_main&" +
  "-out=_RAJ2000,_DEJ2000,Vmag&" +
  `-out.max=15000&` +
  `Vmag=<${MAG_LIMIT}`;

async function main() {
  console.log("Fetching Hipparcos star catalog from VizieR...");
  const resp = await fetch(VIZIER_URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  const text = await resp.text();

  const lines = text.split("\n");
  const stars = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("-") || line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const ra = parseFloat(parts[0]);
    const dec = parseFloat(parts[1]);
    const mag = parseFloat(parts[2]);
    if (isNaN(ra) || isNaN(dec) || isNaN(mag)) continue;
    if (mag > MAG_LIMIT) continue;
    stars.push({ ra: +ra.toFixed(4), dec: +dec.toFixed(4), mag: +mag.toFixed(2) });
  }

  console.log(`Parsed ${stars.length} stars (mag <= ${MAG_LIMIT})`);
  writeFileSync(OUT_PATH, JSON.stringify(stars));
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
