/**
 * Generates a political-style equirectangular Earth texture:
 * plain blue ocean, light-colored land masses with country outlines.
 *
 * Uses Natural Earth 110m GeoJSON (public domain) for country polygons.
 *
 * Usage:  node scripts/build-earth-texture.mjs
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "public", "earth_political.png");

const W = 4096;
const H = 2048;

const OCEAN_COLOR = "#8ec8e8";
const LAND_COLOR = "#f5f0dc";
const BORDER_COLOR = "#999999";
const COAST_COLOR = "#777777";
const GRID_COLOR = "rgba(255,255,255,0.08)";

const GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

function lonLatToXY(lon, lat) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

function drawPolygon(ctx, ring, fill, stroke, lineWidth) {
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = lonLatToXY(ring[i][0], ring[i][1]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

function drawFeature(ctx, geometry) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      drawPolygon(ctx, ring, LAND_COLOR, null, 0);
    }
    for (const ring of geometry.coordinates) {
      drawPolygon(ctx, ring, null, BORDER_COLOR, 1.5);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        drawPolygon(ctx, ring, LAND_COLOR, null, 0);
      }
    }
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        drawPolygon(ctx, ring, null, BORDER_COLOR, 1.5);
      }
    }
  }
}

function drawCoastlines(ctx, geometry) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      drawPolygon(ctx, ring, null, COAST_COLOR, 2);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        drawPolygon(ctx, ring, null, COAST_COLOR, 2);
      }
    }
  }
}

function drawGrid(ctx) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = lonLatToXY(lon, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const [, y] = lonLatToXY(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // equator slightly brighter
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  const [, eqY] = lonLatToXY(0, 0);
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(W, eqY);
  ctx.stroke();
}

async function main() {
  console.log("Fetching Natural Earth 110m country boundaries...");
  const resp = await fetch(GEOJSON_URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const geo = await resp.json();
  console.log(`Got ${geo.features.length} countries`);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ocean background
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillRect(0, 0, W, H);

  // fill land
  for (const f of geo.features) drawFeature(ctx, f.geometry);

  // coastlines on top
  for (const f of geo.features) drawCoastlines(ctx, f.geometry);

  // grid
  drawGrid(ctx);

  const buf = canvas.toBuffer("image/png");
  writeFileSync(OUT_PATH, buf);
  console.log(`Wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
