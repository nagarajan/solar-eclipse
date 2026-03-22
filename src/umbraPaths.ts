import * as THREE from "three";
import { EARTH_RADIUS_KM } from "./ephemeris";

const PATH_R = EARTH_RADIUS_KM * 1.003;

let pathIndex: Record<string, number[][]> | null = null;

export async function loadUmbraPaths(): Promise<void> {
  const resp = await fetch("/umbra_paths.json");
  pathIndex = await resp.json();
}

export function getUmbraPath(dateLabel: string): THREE.Vector3[] | null {
  if (!pathIndex) return null;
  const latLons = pathIndex[dateLabel];
  if (!latLons) return null;

  const points: THREE.Vector3[] = [];
  for (const [lat, lon] of latLons) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    points.push(
      new THREE.Vector3(
        PATH_R * cosLat * Math.cos(lonRad),
        PATH_R * Math.sin(latRad),
        -PATH_R * cosLat * Math.sin(lonRad)
      )
    );
  }
  return points;
}
