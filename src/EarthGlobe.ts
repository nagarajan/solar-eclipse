import * as THREE from "three";
import { EARTH_RADIUS_KM } from "./ephemeris";

const EARTH_SEGMENTS = 128;

const vertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uDayTex;
uniform vec3 uSunPos;
uniform vec3 uMoonPos;
uniform float uSunRadius;
uniform float uMoonRadius;
uniform float uBrightMul;
uniform float uOceanBoost;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

/*
 * Compute the overlap area of two circles with radii r1, r2
 * whose centres are separated by distance d.
 * Returns a value in [0, pi*r1*r1].
 */
float circleOverlap(float r1, float r2, float d) {
  if (d >= r1 + r2) return 0.0;
  if (d + r2 <= r1) return 3.14159265 * r2 * r2;
  if (d + r1 <= r2) return 3.14159265 * r1 * r1;

  float r1sq = r1 * r1;
  float r2sq = r2 * r2;
  float dsq  = d * d;
  float a1 = acos((dsq + r1sq - r2sq) / (2.0 * d * r1));
  float a2 = acos((dsq + r2sq - r1sq) / (2.0 * d * r2));
  return r1sq * a1 + r2sq * a2
       - 0.5 * sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));
}

void main() {
  vec3 toSun  = uSunPos  - vWorldPos;
  vec3 toMoon = uMoonPos - vWorldPos;

  float dSun  = length(toSun);
  float dMoon = length(toMoon);

  // apparent angular radii (small-angle: sin ~ angle)
  float angSun  = uSunRadius  / dSun;
  float angMoon = uMoonRadius / dMoon;

  // angular separation between the two disk centres as seen from this fragment
  float cosSep = dot(normalize(toSun), normalize(toMoon));
  float angSep = acos(clamp(cosSep, -1.0, 1.0));

  // fraction of solar disk area blocked by the moon
  float sunArea = 3.14159265 * angSun * angSun;
  float blocked = circleOverlap(angSun, angMoon, angSep);
  float occlusion = clamp(blocked / sunArea, 0.0, 1.0);

  // Lambertian with a wide half-lit wrap to brighten the visible hemisphere
  float NdotL = dot(vNormal, normalize(toSun));
  float wrapped = clamp(NdotL * 0.6 + 0.4, 0.0, 1.0);

  // atmospheric scattering approximation for the terminator
  float scatter = smoothstep(-0.15, 0.05, NdotL);

  float light = mix(0.06, 1.2, scatter * wrapped) * uBrightMul * (1.0 - occlusion);

  vec4 tex = texture2D(uDayTex, vUv);
  float blueDom = tex.b - max(tex.r, tex.g);
  float oceanMask = smoothstep(0.0, 0.08, blueDom);
  vec3 color = tex.rgb * (1.0 + oceanMask * uOceanBoost);
  gl_FragColor = vec4(color * light, 1.0);
}
`;

export class EarthGlobe {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private loader = new THREE.TextureLoader();

  constructor(textureUrl: string) {
    const tex = this.loader.load(textureUrl);
    tex.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uDayTex: { value: tex },
        uSunPos: { value: new THREE.Vector3() },
        uMoonPos: { value: new THREE.Vector3() },
        uSunRadius: { value: 1 },
        uMoonRadius: { value: 1 },
        uBrightMul: { value: 1.0 },
        uOceanBoost: { value: 0.0 },
      },
      vertexShader,
      fragmentShader,
    });

    const geo = new THREE.SphereGeometry(
      EARTH_RADIUS_KM,
      EARTH_SEGMENTS,
      EARTH_SEGMENTS / 2
    );
    this.mesh = new THREE.Mesh(geo, this.material);
  }

  update(
    sunPos: THREE.Vector3,
    moonPos: THREE.Vector3,
    sunRadius: number,
    moonRadius: number,
    gmstDeg: number,
  ) {
    this.material.uniforms.uSunPos.value.copy(sunPos);
    this.material.uniforms.uMoonPos.value.copy(moonPos);
    this.material.uniforms.uSunRadius.value = sunRadius;
    this.material.uniforms.uMoonRadius.value = moonRadius;

    this.mesh.rotation.y = THREE.MathUtils.degToRad(gmstDeg);
  }

  setTexture(url: string, brightnessMul = 1.0, oceanBoost = 0.0) {
    const tex = this.loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const old = this.material.uniforms.uDayTex.value as THREE.Texture;
    this.material.uniforms.uDayTex.value = tex;
    this.material.uniforms.uBrightMul.value = brightnessMul;
    this.material.uniforms.uOceanBoost.value = oceanBoost;
    old.dispose();
  }
}
