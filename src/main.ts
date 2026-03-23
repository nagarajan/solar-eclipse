import "./style.css";
import { buildEclipseCatalog, type EclipseEntry } from "./eclipseCatalog";
import { SolarSystemScene } from "./SolarSystemScene";
import { loadCountryIndex } from "./countryCatalog";
import { loadUmbraPaths } from "./umbraPaths";
const withBase = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const listEl = document.getElementById("eclipse-list")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const countryInput = document.getElementById("country-input") as HTMLInputElement;
const timeSlider = document.getElementById("time-slider") as HTMLInputElement;
const timeLabel = document.getElementById("time-label")!;
const infoEl = document.getElementById("eclipse-info")!;
const pivotEarthBtn = document.getElementById("pivot-earth")!;
const pivotMoonBtn = document.getElementById("pivot-moon")!;
const filterBtns = document.querySelectorAll<HTMLButtonElement>(".filter-btn");
const texPoliticalBtn = document.getElementById("tex-political")!;
const texRealisticBtn = document.getElementById("tex-realistic")!;
const starParallaxCb = document.getElementById("star-parallax") as HTMLInputElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const scene = new SolarSystemScene(canvas);

// -- eclipse catalog --
const catalog = buildEclipseCatalog(1900, 2100);
let activeKindFilter = "total+annular";
let searchText = "";
let countrySearch = "";
let selectedItem: HTMLElement | null = null;

function formatTimeLabel(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h > 0) return `${sign}${h}h ${m}m`;
  return `${sign}${m} min`;
}

function showEclipseInfo(entry: EclipseEntry) {
  const d = entry.peak.date;
  const utc = d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  let html = `<strong>${entry.kind}</strong> solar eclipse<br>${utc}`;
  if (entry.latitude !== undefined && entry.longitude !== undefined) {
    html += `<br>Peak: ${entry.latitude.toFixed(1)}, ${entry.longitude.toFixed(1)}`;
  }
  if (entry.countries && entry.countries.length > 0) {
    html += `<br>Path: ${entry.countries.join(", ")}`;
  }
  html += `<br><a href="${entry.url}" target="_blank" rel="noopener" class="eclipse-link">More info</a>`;
  infoEl.innerHTML = html;
}

function selectEclipse(entry: EclipseEntry, el: HTMLElement) {
  selectedItem?.classList.remove("selected");
  selectedItem = el;
  el.classList.add("selected");
  el.scrollIntoView({ block: "nearest" });

  timeSlider.value = "0";
  timeLabel.textContent = "+0 min";
  scene.selectEclipse(entry);
  showEclipseInfo(entry);
}

function renderList() {
  listEl.innerHTML = "";
  const filtered = catalog.filter((e) => {
    if (activeKindFilter === "total+annular" && e.kind === "Partial") return false;
    if (activeKindFilter !== "all" && activeKindFilter !== "total+annular" && e.kind !== activeKindFilter) return false;
    if (searchText && !e.label.includes(searchText)) return false;
    if (countrySearch) {
      if (!e.countries) return false;
      const q = countrySearch.toLowerCase();
      if (!e.countries.some((c) => c.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  for (const entry of filtered) {
    const row = document.createElement("div");
    row.className = "eclipse-item";
    row.innerHTML =
      `<span class="date">${entry.label}</span>` +
      `<span class="kind" data-kind="${entry.kind}">${entry.kind}</span>`;
    row.addEventListener("click", () => selectEclipse(entry, row));
    listEl.appendChild(row);
  }
}

// -- event wiring --
searchInput.addEventListener("input", () => {
  searchText = searchInput.value.trim();
  renderList();
});

countryInput.addEventListener("input", () => {
  countrySearch = countryInput.value.trim();
  renderList();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeKindFilter = btn.dataset.kind ?? "all";
    renderList();
  });
});

timeSlider.addEventListener("input", () => {
  const minutes = parseInt(timeSlider.value, 10);
  timeLabel.textContent = formatTimeLabel(minutes);
  scene.setTimeOffset(minutes);
});

pivotEarthBtn.addEventListener("click", () => {
  pivotEarthBtn.classList.add("active");
  pivotMoonBtn.classList.remove("active");
  scene.setPivot("earth");
});

pivotMoonBtn.addEventListener("click", () => {
  pivotMoonBtn.classList.add("active");
  pivotEarthBtn.classList.remove("active");
  scene.setPivot("moon");
});

texPoliticalBtn.addEventListener("click", () => {
  texPoliticalBtn.classList.add("active");
  texRealisticBtn.classList.remove("active");
  scene.setEarthTexture(withBase("earth_political.png"));
});

texRealisticBtn.addEventListener("click", () => {
  texRealisticBtn.classList.add("active");
  texPoliticalBtn.classList.remove("active");
  scene.setEarthTexture(withBase("earth_realistic.jpg"), 1.4, 1.2);
});

starParallaxCb.addEventListener("change", () => {
  scene.setStarParallax(starParallaxCb.checked);
});

// -- init --
renderList();

// auto-select closest future eclipse
const now = Date.now();
const upcoming = catalog.find((e) => e.peak.date.getTime() >= now) ?? catalog[0];
const upcomingEl = listEl.children[catalog.indexOf(upcoming)] as HTMLElement | undefined;
if (upcomingEl) {
  selectEclipse(upcoming, upcomingEl);
}

// load pre-built data files
loadUmbraPaths();
countryInput.disabled = true;
countryInput.placeholder = "Loading country data...";
loadCountryIndex(catalog).then(() => {
  countryInput.disabled = false;
  countryInput.placeholder = "Search by country...";
});
