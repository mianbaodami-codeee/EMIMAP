"""将 Natural Earth 1:50m 国家与湖泊数据转换为运行时底图。

用法：python apps/web/scripts/update-atlas.py countries.geojson lakes.geojson
原始数据来自 Natural Earth（公有领域）。
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "public/atlas"


def round_coordinates(coordinates):
    if isinstance(coordinates[0], (int, float)):
        return [round(coordinates[0], 3), round(coordinates[1], 3)]
    return [round_coordinates(child) for child in coordinates]


def load_features(source, name_field):
    features = json.loads(Path(source).read_text(encoding="utf-8"))["features"]
    return [{
        "type": "Feature",
        "properties": {"name": feature["properties"].get(name_field) or ""},
        "geometry": {
            "type": feature["geometry"]["type"],
            "coordinates": round_coordinates(feature["geometry"]["coordinates"]),
        },
    } for feature in features if feature.get("geometry")]


def paths(features):
    for feature in features:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            rings = ["M" + " ".join(f"{lon + 180:.2f},{90 - lat:.2f}" for lon, lat in ring) + "Z" for ring in polygon]
            yield '<path d="' + "".join(rings) + '"/>'


countries = load_features(sys.argv[1], "NAME")
lakes = load_features(sys.argv[2], "name")
for name, features in [("countries", countries), ("lakes", lakes)]:
    data = {"type": "FeatureCollection", "features": features}
    (root / f"{name}.geojson").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">
<style>
:root{color-scheme:light dark}.land{fill:#c7dcd0;stroke:#6d9693}.lakes{fill:#dcecf3}
@media(prefers-color-scheme:dark){.land{fill:#253e44;stroke:#4a6c76}.lakes{fill:#101f2e}}
</style>
<g class="land" stroke-width=".22" stroke-linejoin="round" fill-rule="evenodd">
''' + "\n".join(paths(countries)) + '</g><g class="lakes" fill-rule="evenodd">\n' + "\n".join(paths(lakes)) + "</g></svg>\n"
(root / "world.svg").write_text(svg, encoding="utf-8")
