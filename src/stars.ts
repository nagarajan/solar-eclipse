import * as THREE from "three";

const FLAT_RADIUS = 5e8;
const LAYER_RADII = [5e4, 2e5, 1e6, 1e7, FLAT_RADIUS];
const NUM_LAYERS = LAYER_RADII.length;

interface StarRecord {
  ra: number;
  dec: number;
  mag: number;
}

const starMaterial = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: /* glsl */ `
    attribute float aSize;
    varying float vSize;
    void main() {
      vSize = aSize;
      gl_PointSize = aSize;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vSize;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float alpha = 1.0 - smoothstep(0.3, 0.5, d);
      float brightness = 0.7 + 0.3 * (vSize / 4.5);
      gl_FragColor = vec4(vec3(brightness), alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
});

export class StarField {
  readonly group = new THREE.Group();
  private layers: {
    points: THREE.Points;
    directions: Float32Array;
    radius: number;
  }[] = [];
  private parallax = false;

  constructor(stars: StarRecord[]) {
    const buckets: StarRecord[][] = Array.from({ length: NUM_LAYERS }, () => []);
    for (let i = 0; i < stars.length; i++) {
      buckets[i % NUM_LAYERS].push(stars[i]);
    }

    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      const bucket = buckets[layer];
      const directions = new Float32Array(bucket.length * 3);
      const positions = new Float32Array(bucket.length * 3);
      const sizes = new Float32Array(bucket.length);

      for (let i = 0; i < bucket.length; i++) {
        const { ra, dec, mag } = bucket[i];
        const raRad = THREE.MathUtils.degToRad(ra);
        const decRad = THREE.MathUtils.degToRad(dec);
        const cosDec = Math.cos(decRad);

        const dx = cosDec * Math.cos(raRad);
        const dy = Math.sin(decRad);
        const dz = -cosDec * Math.sin(raRad);

        directions[i * 3] = dx;
        directions[i * 3 + 1] = dy;
        directions[i * 3 + 2] = dz;

        const r = FLAT_RADIUS;
        positions[i * 3] = dx * r;
        positions[i * 3 + 1] = dy * r;
        positions[i * 3 + 2] = dz * r;

        sizes[i] = Math.max(1.0, 4.5 - mag * 0.6);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

      const points = new THREE.Points(geo, starMaterial);
      this.group.add(points);
      this.layers.push({ points, directions, radius: LAYER_RADII[layer] });
    }
  }

  setParallax(on: boolean) {
    if (on === this.parallax) return;
    this.parallax = on;

    for (const layer of this.layers) {
      const r = on ? layer.radius : FLAT_RADIUS;
      const pos = layer.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const dirs = layer.directions;
      for (let i = 0; i < dirs.length; i++) {
        arr[i] = dirs[i] * r;
      }
      pos.needsUpdate = true;
    }
  }
}

export async function buildStarField(url: string): Promise<StarField> {
  const resp = await fetch(url);
  const stars: StarRecord[] = await resp.json();
  return new StarField(stars);
}
