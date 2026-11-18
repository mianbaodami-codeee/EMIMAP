import type { GeoSearchCandidate, ReverseGeocodeResult } from "@omnikit/shared";
import { WORLD_ATLAS_GAZETTEER, type GazetteerEntry } from "./world-atlas-data";

export function computeHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371.0088;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((R * c).toFixed(2));
}

export function formatHemisphere(lat: number, lon: number): string {
  const ns = lat >= 0 ? "北半球 (N)" : "南半球 (S)";
  const ew = lon >= 0 ? "东半球 (E)" : "西半球 (W)";
  return `${ns} · ${ew}`;
}

export function estimateSolarUtcOffset(lon: number): string {
  const offsetHours = Math.round(lon / 15);
  if (offsetHours === 0) return "UTC±00:00 (本初子午线时区带)";
  const sign = offsetHours > 0 ? "+" : "-";
  const abs = String(Math.abs(offsetHours)).padStart(2, "0");
  return `UTC${sign}${abs}:00 (经度太阳时估算)`;
}

export function searchBuiltinGazetteer(rawQuery: string): GeoSearchCandidate[] {
  const kw = rawQuery.trim().toLowerCase();
  if (!kw) return [];

  // 支持直接输入坐标如 "31.2304, 121.4737"
  const coordMatch = kw.match(
    /^(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)$/
  );
  const results: GeoSearchCandidate[] = [];

  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      results.push({
        id: `coord-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        name: `坐标点 (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`,
        displayName: `WGS84 精确坐标 · 纬度 ${lat.toFixed(4)}°, 经度 ${lon.toFixed(4)}°`,
        latitude: lat,
        longitude: lon,
        country: "精确坐标定位",
        countryCode: "WGS84",
        category: "经纬度直达",
        source: "builtin_gazetteer",
      });
    }
  }

  const scored: Array<{ score: number; entry: GazetteerEntry }> = [];
  for (const entry of WORLD_ATLAS_GAZETTEER) {
    let score = 0;
    const nameLower = entry.name.toLowerCase();
    const enLower = entry.englishName.toLowerCase();
    if (nameLower === kw || enLower === kw) score += 100;
    else if (nameLower.includes(kw) || enLower.includes(kw)) score += 70;
    if (entry.aliases.some((a) => a.toLowerCase().includes(kw))) score += 55;
    if (
      entry.country.toLowerCase().includes(kw) ||
      entry.adminArea.toLowerCase().includes(kw) ||
      entry.category.toLowerCase().includes(kw)
    ) {
      score += 35;
    }
    if (score > 0) {
      scored.push({ score, entry });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  for (const { entry } of scored.slice(0, 8)) {
    results.push({
      id: entry.id,
      name: `${entry.name} (${entry.englishName})`,
      displayName: `${entry.name} · ${entry.adminArea}, ${entry.country} (${entry.category})`,
      latitude: entry.latitude,
      longitude: entry.longitude,
      country: entry.country,
      countryCode: entry.countryCode,
      adminArea: entry.adminArea,
      city: entry.city,
      category: entry.category,
      source: "builtin_gazetteer",
    });
  }

  return results;
}


/** 离线时仅对索引中的确切坐标填充地名，任意选点保留真实经纬度。 */
export function atlasPlace(latitude: number, longitude: number): ReverseGeocodeResult {
  const entry = WORLD_ATLAS_GAZETTEER.find(p =>
    Math.abs(p.latitude - latitude) < 0.00001 && Math.abs(p.longitude - longitude) < 0.00001);
  const coordinates = latitude.toFixed(4) + "°, " + longitude.toFixed(4) + "°";
  return {
    latitude, longitude, name: entry?.name ?? coordinates,
    displayName: entry ? entry.name + " · " + entry.country : coordinates,
    country: entry?.country ?? "待联网识别", countryCode: entry?.countryCode ?? "",
    city: entry?.city ?? "待联网识别", adminArea: entry?.adminArea ?? "待联网识别",
    hemisphere: formatHemisphere(latitude, longitude), timezoneEstimate: estimateSolarUtcOffset(longitude),
    elevationOrTerrain: entry?.elevationOrTerrain, nearbyPois: [], dataMode: "local_gazetteer",
    queriedAt: new Date().toISOString(), osmAttribution: "Natural Earth · 本地地名索引",
  };
}
