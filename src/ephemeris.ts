import {
  HelioVector,
  GeoVector,
  Body,
  type AstroTime,
  MakeTime,
  SiderealTime,
} from "astronomy-engine";
import * as THREE from "three";

export const AU_KM = 1.4959787e8;
export const SUN_RADIUS_KM = 695700;
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;

export interface BodyPositions {
  sunEcl: THREE.Vector3;
  earthEcl: THREE.Vector3;
  moonEcl: THREE.Vector3;
  moonFromEarth: THREE.Vector3;
  sunFromEarth: THREE.Vector3;
  gmstDeg: number;
}

// astronomy-engine J2000 equatorial: X = vernal equinox, Z = north celestial pole
// Three.js / star field / SphereGeometry: X = vernal equinox, Y = north pole
function astroVecToThree(v: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(v.x * AU_KM, v.z * AU_KM, -v.y * AU_KM);
}

export function getBodyPositions(time: AstroTime): BodyPositions {
  const sunEcl = new THREE.Vector3(0, 0, 0);
  const earthEcl = astroVecToThree(HelioVector(Body.Earth, time));
  const moonGeo = astroVecToThree(GeoVector(Body.Moon, time, true));
  const moonEcl = earthEcl.clone().add(moonGeo);

  const sunFromEarth = sunEcl.clone().sub(earthEcl);
  const moonFromEarth = moonGeo.clone();

  const gmstDeg = SiderealTime(time) * 15;

  return { sunEcl, earthEcl, moonEcl, moonFromEarth, sunFromEarth, gmstDeg };
}

export function offsetMinutes(base: AstroTime, minutes: number): AstroTime {
  return MakeTime(new Date(base.date.getTime() + minutes * 60_000));
}
