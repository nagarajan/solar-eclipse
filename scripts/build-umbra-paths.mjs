/**
 * Pre-computes the umbra center path (lat/lon) for every total and annular
 * eclipse from 1900-2100, with high-precision 10-second sampling.
 *
 * Output: public/umbra_paths.json
 *   { "YYYY-MM-DD": [[lat, lon], [lat, lon], ...], ... }
 *
 * Usage:  node scripts/build-umbra-paths.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ae = require("astronomy-engine");
const THREE = require("three");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "public", "umbra_paths.json");

const AU_KM = 1.4959787e8;
const EARTH_R = 6371 * 1.003;
const START_YEAR = 1900;
const END_YEAR = 2100;
const RANGE_MINUTES = 240;
const STEP_SECONDS = 10;

function astroVecToThree(v) {
  return new THREE.Vector3(v.x * AU_KM, v.z * AU_KM, -v.y * AU_KM);
}

function computePathLatLons(peak) {
  const points = [];
  const startMs = peak.date.getTime() - RANGE_MINUTES * 60_000;
  const endMs = peak.date.getTime() + RANGE_MINUTES * 60_000;
  const stepMs = STEP_SECONDS * 1000;

  for (let ms = startMs; ms <= endMs; ms += stepMs) {
    const t = ae.MakeTime(new Date(ms));
    const earth = astroVecToThree(ae.HelioVector(ae.Body.Earth, t));
    const moonGeo = astroVecToThree(ae.GeoVector(ae.Body.Moon, t, true));
    const sunFromEarth = new THREE.Vector3(0, 0, 0).sub(earth);
    const moonFromEarth = moonGeo.clone();

    const dir = moonFromEarth.clone().sub(sunFromEarth).normalize();
    const origin = moonFromEarth;
    const halfB = origin.dot(dir);
    const c = origin.dot(origin) - EARTH_R * EARTH_R;
    const disc = halfB * halfB - c;
    if (disc < 0) continue;
    const tVal = -halfB - Math.sqrt(disc);
    if (tVal < 0) continue;

    const hit = origin.clone().add(dir.clone().multiplyScalar(tVal));

    const gmstDeg = ae.SiderealTime(t) * 15;
    const g = (-gmstDeg * Math.PI) / 180;
    const cosG = Math.cos(g);
    const sinG = Math.sin(g);
    const fx = hit.x * cosG + hit.z * sinG;
    const fy = hit.y;
    const fz = -hit.x * sinG + hit.z * cosG;

    const r = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const lat = +((Math.asin(fy / r) * 180) / Math.PI).toFixed(3);
    const lon = +((Math.atan2(-fz, fx) * 180) / Math.PI).toFixed(3);
    points.push([lat, lon]);
  }
  return points;
}

function main() {
  console.log(`Finding total/annular eclipses ${START_YEAR}-${END_YEAR}...`);
  const eclipses = [];
  const startDate = ae.MakeTime(new Date(Date.UTC(START_YEAR, 0, 1)));
  const endDate = new Date(Date.UTC(END_YEAR, 11, 31));
  let info = ae.SearchGlobalSolarEclipse(startDate);
  while (info.peak.date.getTime() <= endDate.getTime()) {
    if (info.kind === "total" || info.kind === "annular") {
      eclipses.push(info);
    }
    info = ae.NextGlobalSolarEclipse(info.peak);
  }
  console.log(`  ${eclipses.length} total/annular eclipses`);

  console.log(`Computing paths (${STEP_SECONDS}s steps, +/-${RANGE_MINUTES}m)...`);
  const result = {};
  for (let i = 0; i < eclipses.length; i++) {
    const e = eclipses[i];
    const d = e.peak.date;
    const label =
      d.getUTCFullYear() +
      "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getUTCDate()).padStart(2, "0");

    result[label] = computePathLatLons(e.peak);

    if ((i + 1) % 10 === 0 || i === eclipses.length - 1) {
      process.stdout.write(`  ${i + 1}/${eclipses.length}\r`);
    }
  }
  console.log();

  writeFileSync(OUT_PATH, JSON.stringify(result));
  const sizeMB = (Buffer.byteLength(JSON.stringify(result)) / (1024 * 1024)).toFixed(1);
  console.log(`Wrote ${OUT_PATH} (${sizeMB} MB)`);
}

main();
