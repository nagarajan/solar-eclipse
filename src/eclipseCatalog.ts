import {
  SearchGlobalSolarEclipse,
  NextGlobalSolarEclipse,
  MakeTime,
  type GlobalSolarEclipseInfo,
  type AstroTime,
} from "astronomy-engine";

export interface EclipseEntry {
  label: string;
  peak: AstroTime;
  kind: "Total" | "Annular" | "Partial";
  latitude: number | undefined;
  longitude: number | undefined;
  distance: number;
  url: string;
  countries?: string[];
}

function eclipseKindLabel(info: GlobalSolarEclipseInfo): EclipseEntry["kind"] {
  switch (info.kind) {
    case "total":
      return "Total";
    case "annular":
      return "Annular";
    default:
      return "Partial";
  }
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function formatPeakLabel(peak: AstroTime): string {
  const d = peak.date;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function eclipseUrl(peak: AstroTime): string {
  const d = peak.date;
  const y = d.getUTCFullYear();
  const m = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  return `https://www.timeanddate.com/eclipse/solar/${y}-${m}-${day}`;
}

export function buildEclipseCatalog(
  startYear: number,
  endYear: number
): EclipseEntry[] {
  const entries: EclipseEntry[] = [];
  const startDate = MakeTime(new Date(Date.UTC(startYear, 0, 1)));
  const endDate = new Date(Date.UTC(endYear, 11, 31));

  let info = SearchGlobalSolarEclipse(startDate);
  while (info.peak.date.getTime() <= endDate.getTime()) {
    entries.push({
      label: formatPeakLabel(info.peak),
      peak: info.peak,
      kind: eclipseKindLabel(info),
      latitude: info.latitude,
      longitude: info.longitude,
      distance: info.distance,
      url: eclipseUrl(info.peak),
    });
    info = NextGlobalSolarEclipse(info.peak);
  }
  return entries;
}
