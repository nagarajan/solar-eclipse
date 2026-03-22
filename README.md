# Solar Eclipse 3D Visualization

Interactive 3D visualization of the Sun-Moon-Earth system during solar eclipses,
built with Three.js and TypeScript.

## Features

- Catalog of solar eclipses from 1900--2100 (total, annular, and partial),
  computed on the fly via the `astronomy-engine` library.
- Accurate heliocentric positions for the Sun, Moon, and Earth at any moment
  around each eclipse, with proper sidereal Earth rotation.
- Per-fragment umbra/penumbra shadow on the Earth, computed analytically from
  the finite angular sizes of the Sun and Moon disks.
- Time scrubber to step forward/backward from peak eclipse and watch the shadow
  sweep across the globe.
- Orbit controls with Earth or Moon pivot.
- Inertial star background from ~8,300 bright stars (Yale Bright Star Catalog,
  J2000 coordinates).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in a browser.

## Rebuilding the star catalog

The star catalog in `public/stars.json` is checked in. To regenerate it from
VizieR:

```bash
node scripts/build-star-catalog.mjs
```

## Data credits

- Earth texture: NASA Visible Earth (public domain)
  https://visibleearth.nasa.gov/
- Star positions: Yale Bright Star Catalog via VizieR / CDS Strasbourg
- Ephemeris: astronomy-engine by Don Cross (MIT)
  https://github.com/cosinekitty/astronomy

## Accuracy note

Positions are computed with `astronomy-engine`, which uses VSOP87 / ELP2000
theory. This is excellent for interactive visualization but is not equivalent
to JPL DE440/441 ephemerides. Absolute shadow positions on the Earth's surface
may differ from NASA eclipse maps by a small amount.
