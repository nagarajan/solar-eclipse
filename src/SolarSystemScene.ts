import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  getBodyPositions,
  offsetMinutes,
  SUN_RADIUS_KM,
  MOON_RADIUS_KM,
  EARTH_RADIUS_KM,
} from "./ephemeris";
import { getUmbraPath } from "./umbraPaths";
import { EarthGlobe } from "./EarthGlobe";
import { buildStarField, StarField } from "./stars";
import type { EclipseEntry } from "./eclipseCatalog";
import type { AstroTime } from "astronomy-engine";

export type PivotTarget = "earth" | "moon";

export class SolarSystemScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private inertialGroup: THREE.Group;
  private earthGroup: THREE.Group;
  private earthGlobe: EarthGlobe;
  private moonMesh: THREE.Mesh;
  private sunMesh: THREE.Mesh;

  private currentEclipse: EclipseEntry | null = null;
  private currentTime: AstroTime | null = null;
  private pivotTarget: PivotTarget = "earth";
  private umbraPath: THREE.Line | null = null;
  private starField: StarField | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.resize();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(45, this.aspect(), 100, 2e9);
    this.camera.position.set(0, 0, EARTH_RADIUS_KM * 5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = EARTH_RADIUS_KM * 1.2;
    this.controls.maxDistance = 2e8;

    // -- inertial group: J2000 equatorial, origin at Earth -
    this.inertialGroup = new THREE.Group();
    this.scene.add(this.inertialGroup);

    // Earth group rotates with sidereal time inside the inertial group
    this.earthGroup = new THREE.Group();
    this.inertialGroup.add(this.earthGroup);

    this.earthGlobe = new EarthGlobe("/earth_political.png");
    this.earthGroup.add(this.earthGlobe.mesh);

    // Moon
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_KM, 64, 32);
    const moonTex = new THREE.TextureLoader().load("/moon_map.jpg");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMat = new THREE.MeshPhongMaterial({ map: moonTex });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.inertialGroup.add(this.moonMesh);

    // Sun
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS_KM, 64, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.inertialGroup.add(this.sunMesh);

    // Ambient light for the moon (so it's visible from all sides faintly)
    const ambient = new THREE.AmbientLight(0xffffff, 0.05);
    this.inertialGroup.add(ambient);

    // Point light at the sun position for the moon illumination
    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0);
    this.sunMesh.add(sunLight);

    // Stars
    buildStarField("/stars.json").then((sf) => {
      this.starField = sf;
      this.inertialGroup.add(sf.group);
    });

    window.addEventListener("resize", () => this.resize());
    this.animate();
  }

  private aspect(): number {
    const canvas = this.renderer.domElement;
    return canvas.clientWidth / canvas.clientHeight;
  }

  private resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  selectEclipse(entry: EclipseEntry) {
    this.currentEclipse = entry;
    this.setTimeOffset(0);
    this.updateUmbraPath(entry);

    // Position camera nicely: from above the eclipse sub-solar point
    const bp = getBodyPositions(entry.peak);
    const moonDir = bp.moonFromEarth.clone().normalize();
    const camPos = moonDir
      .clone()
      .multiplyScalar(EARTH_RADIUS_KM * 4)
      .add(new THREE.Vector3(0, EARTH_RADIUS_KM * 1.5, 0));
    this.camera.position.copy(camPos);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private updateUmbraPath(entry: EclipseEntry) {
    if (this.umbraPath) {
      this.umbraPath.removeFromParent();
      this.umbraPath.geometry.dispose();
      (this.umbraPath.material as THREE.Material).dispose();
      this.umbraPath = null;
    }

    const points = getUmbraPath(entry.label);
    if (!points || points.length < 2) return;

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xff3333, depthWrite: false });
    this.umbraPath = new THREE.Line(geo, mat);
    this.earthGlobe.mesh.add(this.umbraPath);
  }

  setTimeOffset(minutes: number) {
    if (!this.currentEclipse) return;
    this.currentTime = offsetMinutes(this.currentEclipse.peak, minutes);
    this.updatePositions();
  }

  setEarthTexture(url: string, brightnessMul = 1.0, oceanBoost = 0.0) {
    this.earthGlobe.setTexture(url, brightnessMul, oceanBoost);
  }

  setStarParallax(on: boolean) {
    this.starField?.setParallax(on);
  }

  setPivot(target: PivotTarget) {
    this.pivotTarget = target;
    this.updateControlsTarget();
  }

  private updatePositions() {
    if (!this.currentTime) return;
    const bp = getBodyPositions(this.currentTime);

    // Everything is Earth-centred: Earth at origin, Moon and Sun as offsets
    this.sunMesh.position.copy(bp.sunFromEarth);
    this.moonMesh.position.copy(bp.moonFromEarth);

    this.earthGlobe.update(
      bp.sunFromEarth,
      bp.moonFromEarth,
      SUN_RADIUS_KM,
      MOON_RADIUS_KM,
      bp.gmstDeg
    );

    this.updateControlsTarget();
  }

  private updateControlsTarget() {
    if (this.pivotTarget === "moon") {
      this.controls.target.copy(this.moonMesh.position);
    } else {
      this.controls.target.set(0, 0, 0);
    }
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
