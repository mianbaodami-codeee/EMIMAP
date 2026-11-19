import type { StyleSpecification } from "maplibre-gl";
import { buildWorldGraticuleGeoJson, WORLD_ATLAS_GAZETTEER } from "./world-atlas-data";

export const atlasMajorCities = new Set([
  "gz-sanfrancisco", "gz-newyork", "gz-saopaulo", "gz-london", "gz-cairo",
  "gz-dubai", "gz-bengaluru", "gz-beijing", "gz-tokyo", "gz-singapore", "gz-sydney",
]);

export const streetZoom = 5;
export const mapMaxZoom = 19;
export const mapMinZoom = -1.2;
export const mapWorldBounds: [[number, number], [number, number]] = [[-179, -65], [179, 79]];

export function buildEmbeddedMapStyle(dark: boolean): StyleSpecification {
  const waterColor = dark ? "#101f2e" : "#dcecf3";
  const landFill = dark ? "#253e44" : "#c7dcd0";
  const landStroke = dark ? "#4a6c76" : "#6d9693";
  const gridColor = dark ? "rgba(148,163,184,0.16)" : "rgba(72,116,132,0.19)";

  return {
    version: 8,
    sources: {
      landmass: { type: "geojson", data: "/atlas/countries.geojson" },
      lakes: { type: "geojson", data: "/atlas/lakes.geojson" },
      streets: {
        type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256,
        maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      graticule: { type: "geojson", data: buildWorldGraticuleGeoJson() },
      hubs: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: WORLD_ATLAS_GAZETTEER.map(place => ({
            type: "Feature",
            properties: { major: atlasMajorCities.has(place.id) },
            geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
          })),
        },
      },
    },
    layers: [
      { id: "ocean-bg", type: "background", paint: { "background-color": waterColor } },
      { id: "landmass-fill", type: "fill", source: "landmass", paint: { "fill-color": landFill } },
      { id: "landmass-outline", type: "line", source: "landmass", paint: {
        "line-color": landStroke,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 5, 1.1],
      } },
      { id: "lakes-fill", type: "fill", source: "lakes", minzoom: 1.2, paint: { "fill-color": waterColor } },
      { id: "graticule-lines", type: "line", source: "graticule", maxzoom: streetZoom, paint: {
        "line-color": ["match", ["get", "kind"], "equator", dark ? "#507d88" : "#83aeba", gridColor],
        "line-width": ["match", ["get", "kind"], "equator", 0.9, 0.55],
      } },
      { id: "osm-streets", type: "raster", source: "streets", minzoom: streetZoom, paint: {
        "raster-brightness-max": dark ? 0.57 : 1,
        "raster-saturation": dark ? -0.65 : -0.12,
        "raster-fade-duration": 130,
      } },
      { id: "hub-points", type: "circle", source: "hubs", maxzoom: streetZoom, paint: {
        "circle-radius": ["case", ["get", "major"], 3.3, 1.8],
        "circle-color": dark ? "#a5def3" : "#145d7a",
        "circle-stroke-width": 0.8,
        "circle-stroke-color": dark ? "#132b36" : "#f3fbfd",
      } },
    ],
  };
}
