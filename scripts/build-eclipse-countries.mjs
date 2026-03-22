/**
 * Pre-computes the list of countries each total solar eclipse (1900-2100)
 * passes through, using high-precision sampling (10-second steps) and the
 * Natural Earth 110m country boundaries.
 *
 * Output: public/eclipse_countries.json
 *   { "YYYY-MM-DD": ["Country1", "Country2", ...], ... }
 *
 * Usage:  node scripts/build-eclipse-countries.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTRIES_PATH = join(__dirname, "..", "public", "ne_countries.json");
const OUT_PATH = join(__dirname, "..", "public", "eclipse_countries.json");

// -- astronomy-engine (CJS) --
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ae = require("astronomy-engine");
const THREE = require("three");

const AU_KM = 1.4959787e8;
const EARTH_R = 6371 * 1.003;
const START_YEAR = 1900;
const END_YEAR = 2100;
const RANGE_MINUTES = 240;
const STEP_SECONDS = 10;

// -- geo helpers --

function loadCountryFeatures() {
  const raw = JSON.parse(readFileSync(COUNTRIES_PATH, "utf-8"));
  return raw.features.map((f) => {
    const name = f.properties.ADMIN || f.properties.NAME;
    const geom = f.geometry;
    const polygons =
      geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
    return { name, polygons };
  });
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInCountry(lon, lat, country) {
  for (const polygon of country.polygons) {
    if (!pointInRing(lon, lat, polygon[0])) continue;
    let inHole = false;
    for (let h = 1; h < polygon.length; h++) {
      if (pointInRing(lon, lat, polygon[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

// -- ephemeris helpers --

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
    const lat = (Math.asin(fy / r) * 180) / Math.PI;
    const lon = (Math.atan2(-fz, fx) * 180) / Math.PI;
    points.push({ lat, lon });
  }
  return points;
}

function countriesForPath(pathPoints, countryFeatures) {
  const found = new Set();
  for (const p of pathPoints) {
    for (const c of countryFeatures) {
      if (found.has(c.name)) continue;
      if (pointInCountry(p.lon, p.lat, c)) {
        found.add(c.name);
      }
    }
  }
  return Array.from(found).sort();
}

// -- main --

function main() {
  console.log("Loading country boundaries...");
  const countryFeatures = loadCountryFeatures();
  console.log(`  ${countryFeatures.length} countries`);

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

  console.log(`Computing country paths (${STEP_SECONDS}s steps, +/-${RANGE_MINUTES}m range)...`);
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

    const pathPts = computePathLatLons(e.peak);
    const countries = countriesForPath(pathPts, countryFeatures);
    result[label] = countries;

    if ((i + 1) % 10 === 0 || i === eclipses.length - 1) {
      process.stdout.write(`  ${i + 1}/${eclipses.length}\r`);
    }
  }
  console.log();

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
}

main();
