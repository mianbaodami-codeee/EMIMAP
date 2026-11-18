"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  Compass,
  Crosshair,
  Download,
  FileCode2,
  FileText,
  GitCompare,
  Globe2,
  History,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  resolveClientAIRequestParams,
  type GeoAnalyzeResponse,
  type GeoQueryHistoryItem,
  type GeoSearchCandidate,
  type ReverseGeocodeResult,
  type SavedPlaceItem,
} from "@omnikit/shared";
import {
  buildWorldGraticuleGeoJson,
  WORLD_ATLAS_GAZETTEER,
} from "@/lib/geo/world-atlas-data";
import { atlasPlace, searchBuiltinGazetteer, computeHaversineKm } from "@/lib/geo/atlas";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useAppUI } from "@/components/providers/app-providers";

interface ComparePlaceEntry {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  adminArea: string;
  timezoneEstimate: string;
}

const QUICK_HUB_PRESETS = [
  { label: "上海", lat: 31.2304, lon: 121.4737 },
  { label: "深圳", lat: 22.5431, lon: 114.0579 },
  { label: "东京", lat: 35.6762, lon: 139.6503 },
  { label: "旧金山/硅谷", lat: 37.7749, lon: -122.4194 },
  { label: "伦敦", lat: 51.5074, lon: -0.1278 },
  { label: "新加坡", lat: 1.3521, lon: 103.8198 },
  { label: "法兰克福", lat: 50.1109, lon: 8.6821 },
  { label: "珠穆朗玛峰", lat: 27.9881, lon: 86.925 },
];

const PRESET_GEO_QUESTIONS = [
  "分析该地点的空间区位、地形气候带与网络/交通基础设施优势",
  "评估在此区域部署低延迟云节点或跨国工程协作的时区与地理特征",
  "梳理该坐标周边的核心科技产业群、港口航道或自然地理标志",
];

function buildEmbeddedMapStyle(isDark: boolean) {
  const waterColor = isDark ? "#08111f" : "#dbeafe";
  const landFill = isDark ? "#28474d" : "#c6ded9";
  const landStroke = isDark ? "#334155" : "#94a3b8";
  const gridColor = isDark ? "rgba(148,163,184,0.14)" : "rgba(71,85,105,0.14)";
  const equatorColor = isDark ? "rgba(56,189,248,0.32)" : "rgba(3,105,161,0.28)";
  const hubDotColor = isDark ? "#38bdf8" : "#0369a1";

  const hubGeoJson = {
    type: "FeatureCollection" as const,
    features: WORLD_ATLAS_GAZETTEER.map((g) => ({
      type: "Feature" as const,
      properties: { id: g.id, name: g.name },
      geometry: {
        type: "Point" as const,
        coordinates: [g.longitude, g.latitude],
      },
    })),
  };

  return {
    version: 8 as const,
    sources: {
      landmass: {
        type: "geojson" as const,
        data: "/atlas/countries.geojson",
      },
      streets: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19 },
      graticule: {
        type: "geojson" as const,
        data: buildWorldGraticuleGeoJson(),
      },
      hubs: {
        type: "geojson" as const,
        data: hubGeoJson,
      },
    },
    layers: [
      {
        id: "ocean-bg",
        type: "background" as const,
        paint: { "background-color": waterColor },
      },
      {
        id: "graticule-lines",
        type: "line" as const,
        source: "graticule",
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "equator",
            equatorColor,
            gridColor,
          ],
          "line-width": ["match", ["get", "kind"], "equator", 1.2, 0.7],
        },
      },
      {
        id: "landmass-fill",
        type: "fill" as const,
        source: "landmass",
        paint: {
          "fill-color": landFill,
          "fill-opacity": 0.96,
        },
      },
      {
        id: "landmass-outline",
        type: "line" as const,
        source: "landmass",
        paint: {
          "line-color": landStroke,
          "line-width": 1.15,
        },
      },
      {
        id: "osm-streets", type: "raster" as const, source: "streets", minzoom: 5,
      },
      {
        id: "hub-points",
        type: "circle" as const,
        source: "hubs",
        paint: {
          "circle-radius": 4,
          "circle-color": hubDotColor,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": isDark ? "#090d16" : "#ffffff",
        },
      },
    ],
  };
}

export function MapWorkspace({
  initialPlace,
  initialSavedPlaces,
  initialHistory,
}: {
  initialPlace: ReverseGeocodeResult;
  initialSavedPlaces: SavedPlaceItem[];
  initialHistory: GeoQueryHistoryItem[];
}) {
  const { theme, aiSettings, setAiDrawerOpen } = useAppUI();

  const [selectedPlace, setSelectedPlace] =
    useState<ReverseGeocodeResult>(initialPlace);
  const [savedPlaces, setSavedPlaces] =
    useState<SavedPlaceItem[]>(initialSavedPlaces);
  const [historyList, setHistoryList] =
    useState<GeoQueryHistoryItem[]>(initialHistory);
  const [compareList, setCompareList] = useState<ComparePlaceEntry[]>([
    {
      key: `${initialPlace.latitude.toFixed(3)},${initialPlace.longitude.toFixed(3)}`,
      name: initialPlace.name,
      latitude: initialPlace.latitude,
      longitude: initialPlace.longitude,
      country: initialPlace.country,
      adminArea: initialPlace.adminArea,
      timezoneEstimate: initialPlace.timezoneEstimate,
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const [latInput, setLatInput] = useState(String(initialPlace.latitude));
  const [lonInput, setLonInput] = useState(String(initialPlace.longitude));
  const [loadingReverse, setLoadingReverse] = useState(false);

  const [saveNote, setSaveNote] = useState("");
  const [savingPlace, setSavingPlace] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [question, setQuestion] = useState(PRESET_GEO_QUESTIONS[0]!);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<GeoAnalyzeResponse | null>(null);

  const [activeBottomTab, setActiveBottomTab] = useState<
    "saved" | "compare" | "history"
  >("saved");
  const [lastExportPreview, setLastExportPreview] = useState<{
    format: "GeoJSON" | "Markdown";
    content: string;
  } | null>(null);

  // MapLibre WebGL 实例或高分辩率交互式矢量投影回退模式（无 GPU 容器环境下无缝可用）
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null);
  const mapDarkRef = useRef(false);
  const activeMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const savedMarkersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [renderEngine, setRenderEngine] = useState<"maplibre_webgl" | "svg_atlas">(
    "svg_atlas"
  );
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgCenter, setSvgCenter] = useState<{ lat: number; lon: number }>({
    lat: initialPlace.latitude,
    lon: initialPlace.longitude,
  });

  const selectionRevision = useRef(0);
  const selectCoordinates = useCallback(
    async (lat: number, lon: number, fly = true) => {
      const clampedLat = Math.max(-85, Math.min(85, Number(lat.toFixed(5))));
      const clampedLon = Math.max(-180, Math.min(180, Number(lon.toFixed(5))));
      const revision = ++selectionRevision.current;
      setSelectedPlace(atlasPlace(clampedLat, clampedLon));
      setLatInput(String(clampedLat));
      setLonInput(String(clampedLon));
      if (fly) setSvgCenter({ lat: clampedLat, lon: clampedLon });
      setLoadingReverse(true);
      setErrorBanner(null);

      if (fly && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.flyTo({
            center: [clampedLon, clampedLat],
            zoom: Math.max(mapInstanceRef.current.getZoom(), 3.6),
            duration: 650,
          });
        } catch {}
      }
      if (activeMarkerRef.current) {
        try {
          activeMarkerRef.current.setLngLat([clampedLon, clampedLat]);
        } catch {}
      }

      try {
        const res = await fetch(
          `/api/geo/reverse?lat=${clampedLat}&lon=${clampedLon}`
        );
        const payload = await res.json();
        if (revision !== selectionRevision.current) return;
        if (payload.ok && payload.data) {
          setSelectedPlace(payload.data as ReverseGeocodeResult);
        } else {
          setNotice("当前显示本地底图，联网地点详情暂不可用。");
        }
      } catch {
        if (revision === selectionRevision.current) setNotice("当前显示本地底图，联网地点详情暂不可用。");
      } finally {
        if (revision === selectionRevision.current) setLoadingReverse(false);
      }
    },
    []
  );

  // 初始化 MapLibre GL JS（若当前无硬件/软件 WebGL2 上下文则优雅切换至交互式矢量投影画布）
  useEffect(() => {
    let cancelled = false;
    let instance: import("maplibre-gl").Map | undefined;
    // 首屏保留静态底图。只有完成底图加载后才切换画布。
    const fallback = () => {
      if (cancelled) return;
      setRenderEngine("svg_atlas");
      if (instance) {
        const failed = instance;
        instance = undefined;
        mapInstanceRef.current = null;
        activeMarkerRef.current = null;
        failed.remove();
      }
    };

    async function mountMap() {
      if (!mapContainerRef.current) return;
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !mapContainerRef.current) return;

        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const isDarkNow = document.documentElement.classList.contains("dark");
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: buildEmbeddedMapStyle(isDarkNow) as any,
          center: [10, 18],
          zoom: 0.9,
          attributionControl: false,
        });

        instance = map;
        mapDarkRef.current = isDarkNow;
        map.once("load", () => {
          if (!cancelled && instance === map) {
            map.resize();
            setRenderEngine("maplibre_webgl");
          }
        });
        map.on("webglcontextlost", fallback);
        map.on("error", (ev) => {
          if (
            ("sourceId" in ev && ev.sourceId === "landmass") ||
            String(ev.error?.message || "").toLowerCase().includes("webgl")
          ) {
            fallback();
          }
        });

        map.on("click", (ev: import("maplibre-gl").MapMouseEvent) => {
          void selectCoordinates(ev.lngLat.lat, ev.lngLat.lng, false);
        });

        const markerEl = document.createElement("div");
        markerEl.style.width = "18px";
        markerEl.style.height = "18px";
        markerEl.style.borderRadius = "9999px";
        markerEl.style.background = "#0284c7";
        markerEl.style.border = "3px solid #ffffff";
        markerEl.style.boxShadow = "0 2px 10px rgba(2,132,199,0.55)";

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([initialPlace.longitude, initialPlace.latitude])
          .addTo(map);

        mapInstanceRef.current = map;
        activeMarkerRef.current = marker;
      } catch {
        fallback();
      }
    }

    void mountMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题切换时同步更新 MapLibre 矢量图层配色
  useEffect(() => {
    const map = mapInstanceRef.current;
    const isDark = theme === "dark";
    if (!map || renderEngine !== "maplibre_webgl" || mapDarkRef.current === isDark) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setStyle(buildEmbeddedMapStyle(isDark) as any);
      mapDarkRef.current = isDark;
    } catch {}
  }, [theme, renderEngine]);

  // 同步收藏地点图钉至 MapLibre 画布
  useEffect(() => {
    let active = true;
    async function syncSavedMarkers() {
      const map = mapInstanceRef.current;
      for (const old of savedMarkersRef.current) {
        try {
          old.remove();
        } catch {}
      }
      savedMarkersRef.current = [];
      if (!map || renderEngine !== "maplibre_webgl") return;

      try {
        const maplibregl = await import("maplibre-gl");
        if (!active || !mapInstanceRef.current) return;
        for (const sp of savedPlaces) {
          const pin = document.createElement("div");
          pin.title = sp.name;
          pin.style.width = "12px";
          pin.style.height = "12px";
          pin.style.borderRadius = "9999px";
          pin.style.background = "#f59e0b";
          pin.style.border = "2px solid #ffffff";
          pin.style.cursor = "pointer";
          pin.addEventListener("click", (e) => {
            e.stopPropagation();
            void selectCoordinates(sp.latitude, sp.longitude, true);
          });
          const mk = new maplibregl.Marker({ element: pin })
            .setLngLat([sp.longitude, sp.latitude])
            .addTo(map);
          savedMarkersRef.current.push(mk);
        }
      } catch {}
    }
    void syncSavedMarkers();
    return () => {
      active = false;
    };
  }, [savedPlaces, renderEngine, selectCoordinates]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setErrorBanner(null);
    try {
      const res = await fetch(
        `/api/geo/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      const payload = await res.json();
      if (!payload.ok || !payload.data?.items) throw new Error("search unavailable");
      const list: GeoSearchCandidate[] = payload.data.items;
      setSearchResults(list);
      if (list[0]) await selectCoordinates(list[0].latitude, list[0].longitude);
    } catch {
      const matches = searchBuiltinGazetteer(searchQuery);
      setSearchResults(matches);
      if (matches[0]) await selectCoordinates(matches[0].latitude, matches[0].longitude);
      setNotice(matches.length ? "搜索结果来自本地地名索引。" : "本地索引没有匹配地点，联网搜索暂不可用。");
    } finally {
      setSearching(false);
    }
  };

  const handleCoordJump = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErrorBanner("纬度必须在 -90° 至 90° 之间");
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setErrorBanner("经度必须在 -180° 至 180° 之间");
      return;
    }
    void selectCoordinates(lat, lon, true);
  };

  const handleZoomStep = (delta: number) => {
    if (renderEngine === "maplibre_webgl" && mapInstanceRef.current) {
      const cur = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.zoomTo(Math.max(1, Math.min(14, cur + delta)), {
        duration: 220,
      });
    } else {
      setSvgZoom((z) => Math.max(1, Math.min(6, Number((z + delta * 0.45).toFixed(2)))));
    }
  };

  const handleResetWorldView = () => {
    if (renderEngine === "maplibre_webgl" && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({ center: [20, 22], zoom: 1.5, duration: 500 });
    } else {
      setSvgZoom(1);
      setSvgCenter({ lat: 20, lon: 15 });
    }
  };

  const drag = useRef<{ x: number; y: number; lat: number; lon: number; moved: boolean } | null>(null);
  const handleSvgAtlasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drag.current?.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const spanLon = 360 / svgZoom;
    const spanLat = 180 / svgZoom;
    const minLon = Math.max(-180, Math.min(180 - spanLon, svgCenter.lon - spanLon / 2));
    const maxLat = Math.min(90, Math.max(-90 + spanLat, svgCenter.lat + spanLat / 2));
    const lon = minLon + rx * spanLon;
    const lat = maxLat - ry * spanLat;
    void selectCoordinates(lat, lon, false);
  };

  const handleSaveCurrentPlace = async () => {
    setSavingPlace(true);
    setErrorBanner(null);
    try {
      const res = await fetch("/api/geo/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedPlace.name,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          country: selectedPlace.country,
          adminArea: selectedPlace.adminArea,
          notes: saveNote.trim() || undefined,
          osmMetadata: {
            displayName: selectedPlace.displayName,
            timezoneEstimate: selectedPlace.timezoneEstimate,
            dataMode: selectedPlace.dataMode,
          },
        }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setErrorBanner(payload.error?.message || "保存收藏地点失败");
        return;
      }
      const created = payload.data as SavedPlaceItem;
      setSavedPlaces((prev) => [created, ...prev]);
      setSaveNote("");
      setActiveBottomTab("saved");
      setNotice(`已收藏地点「${created.name}」并持久化至数据库`);
    } catch {
      setErrorBanner("收藏地点请求失败");
    } finally {
      setSavingPlace(false);
    }
  };

  const handleDeleteSaved = async (place: SavedPlaceItem) => {
    const res = await fetch(`/api/geo/places/${place.id}`, {
      method: "DELETE",
    });
    const payload = await res.json();
    if (payload.ok) {
      setSavedPlaces((prev) => prev.filter((p) => p.id !== place.id));
      setNotice(`已移除收藏地点「${place.name}」`);
    }
  };

  const handleAddToCompare = () => {
    const key = `${selectedPlace.latitude.toFixed(3)},${selectedPlace.longitude.toFixed(3)}`;
    setCompareList((prev) => {
      if (prev.some((p) => p.key === key)) {
        return prev;
      }
      const next = [
        ...prev,
        {
          key,
          name: selectedPlace.name,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          country: selectedPlace.country,
          adminArea: selectedPlace.adminArea,
          timezoneEstimate: selectedPlace.timezoneEstimate,
        },
      ];
      return next.slice(-4);
    });
    setActiveBottomTab("compare");
    setNotice(`已将「${selectedPlace.name}」加入多点空间对比矩阵`);
  };

  const handleAskGeoAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAnalyzing(true);
    setErrorBanner(null);

    try {
      const aiReq = resolveClientAIRequestParams(aiSettings);
      const res = await fetch("/api/geo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          placeName: selectedPlace.name,
          question: question.trim(),
          ...aiReq,
        }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setErrorBanner(payload.error?.message || "执行 AI 地理分析失败");
        return;
      }
      const data = payload.data as GeoAnalyzeResponse;
      setAnalysisResult(data);

      // 刷新持久化历史列表
      const histRes = await fetch("/api/geo/history");
      const histPayload = await histRes.json();
      if (histPayload.ok && histPayload.data?.items) {
        setHistoryList(histPayload.data.items as GeoQueryHistoryItem[]);
      }
    } catch {
      setErrorBanner("发起 AI 地理分析请求失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const triggerDownload = (filename: string, mime: string, text: string) => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleExportGeoJson = () => {
    const features = [
      {
        type: "Feature",
        properties: {
          role: "selected_place",
          name: selectedPlace.name,
          country: selectedPlace.country,
          adminArea: selectedPlace.adminArea,
          timezoneEstimate: selectedPlace.timezoneEstimate,
          aiAnalysis: analysisResult?.aiInferred.analysis || null,
        },
        geometry: {
          type: "Point",
          coordinates: [selectedPlace.longitude, selectedPlace.latitude],
        },
      },
      ...savedPlaces.map((sp) => ({
        type: "Feature",
        properties: {
          role: "saved_place",
          id: sp.id,
          name: sp.name,
          country: sp.country,
          adminArea: sp.adminArea,
          notes: sp.notes,
        },
        geometry: {
          type: "Point",
          coordinates: [sp.longitude, sp.latitude],
        },
      })),
    ];

    const geojsonStr = JSON.stringify(
      {
        type: "FeatureCollection",
        generator: "OmniKit AI Geo Intelligence",
        generatedAt: new Date().toISOString(),
        features,
      },
      null,
      2
    );

    setLastExportPreview({ format: "GeoJSON", content: geojsonStr });
    triggerDownload(
      `omnikit-geo-${new Date().toISOString().slice(0, 10)}.geojson`,
      "application/geo+json",
      geojsonStr
    );
    setNotice("已生成并导出标准 RFC 7946 GeoJSON 空间数据文件");
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# OmniKit AI 空间地理分析报告 — ${selectedPlace.name}`,
      "",
      `- **导出时间**：${new Date().toISOString()}`,
      `- **WGS84 坐标**：\`${selectedPlace.latitude.toFixed(4)}°, ${selectedPlace.longitude.toFixed(4)}°\``,
      `- **所属国家/行政区**：${selectedPlace.country} · ${selectedPlace.adminArea}`,
      `- **半球与时区带**：${selectedPlace.hemisphere} · ${selectedPlace.timezoneEstimate}`,
      `- **数据署名**：${selectedPlace.osmAttribution}`,
      "",
      "## 周边参考节点",
      ...selectedPlace.nearbyPois.map(
        (p) => `- ${p.name}（${p.category}）— 距离 ${p.distanceKm} km`
      ),
      "",
    ];

    if (analysisResult) {
      lines.push(
        "## 三源隔离 AI 空间问答记录",
        `- **提问**：${analysisResult.question}`,
        `- **[实测地理要素]**：${analysisResult.measured.summary}`,
        `- **[联网核验信源]**：${analysisResult.webVerified.summary}`,
        `- **[AI 推理结论]**（${
          analysisResult.aiInferred.available
            ? `${analysisResult.aiInferred.provider} / ${analysisResult.aiInferred.model}`
            : "未启用在线模型，降级摘要"
        }）：`,
        "",
        analysisResult.aiInferred.analysis,
        ""
      );
    }

    if (compareList.length > 1) {
      const base = compareList[0]!;
      lines.push("## 多地点大圆距离对比", "");
      for (const item of compareList) {
        const dist = computeHaversineKm(
          base.latitude,
          base.longitude,
          item.latitude,
          item.longitude
        );
        lines.push(
          `- **${item.name}** (${item.country})：\`${item.latitude.toFixed(3)}°, ${item.longitude.toFixed(3)}°\` — 距基准点 ${dist} km`
        );
      }
    }

    const md = lines.join("\n");
    setLastExportPreview({ format: "Markdown", content: md });
    triggerDownload(
      `omnikit-geo-report-${new Date().toISOString().slice(0, 10)}.md`,
      "text/markdown;charset=utf-8",
      md
    );
    setNotice("已生成并导出 Markdown 空间分析报告");
  };

  // 计算 SVG 回退矢量投影视窗参数
  const svgViewBox = useMemo(() => {
    const spanLon = 360 / svgZoom;
    const spanLat = 180 / svgZoom;
    const minLon = Math.max(-180, Math.min(180 - spanLon, svgCenter.lon - spanLon / 2));
    const maxLat = Math.min(90, Math.max(-90 + spanLat, svgCenter.lat + spanLat / 2));
    const minX = minLon + 180;
    const minY = 90 - maxLat;
    return `${minX} ${minY} ${spanLon} ${spanLat}`;
  }, [svgZoom, svgCenter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* 顶部标题与结果导出操作栏 */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              全球地图与 AI 空间分析
            </h1>
            <span
              style={{
                color: "var(--status-measured-fg)",
                backgroundColor: "var(--status-measured-bg)",
                borderColor: "var(--status-measured-border)",
              }}
              className="px-2 py-0.5 rounded border text-[11px] font-mono"
            >
              Phase 2 · MapLibre + OSM
            </span>
          </div>
          <p
            style={{ color: "var(--fg-secondary)" }}
            className="text-xs sm:text-sm max-w-3xl"
          >
            支持全球矢量缩放平移、任意坐标拾取、逆地理行政区识别、多点大圆距离对比与严格区分「实测要素 / 公开信源 / AI 推理」的自然语言空间问答。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            id="geo-export-geojson-btn"
            onClick={handleExportGeoJson}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>导出 GeoJSON</span>
          </button>
          <button
            type="button"
            id="geo-export-md-btn"
            onClick={handleExportMarkdown}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>导出 Markdown 报告</span>
          </button>
          <button
            type="button"
            onClick={() => setAiDrawerOpen(true)}
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent-primary)",
            }}
            className="h-8 px-3 rounded-md font-medium inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>
              模型：{aiSettings.activeProvider === "gemini" ? "Gemini" : "OpenAI"}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          id="geo-banner-notice"
          style={{
            backgroundColor: "var(--status-measured-bg)",
            borderColor: "var(--status-measured-border)",
            color: "var(--status-measured-fg)",
          }}
          className="px-3.5 py-2 rounded-md border text-xs flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="underline opacity-80 hover:opacity-100"
          >
            关闭
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          id="geo-error-banner"
          role="alert"
          style={{
            backgroundColor: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
            color: "var(--danger-fg)",
          }}
          className="px-3.5 py-2 rounded-md border text-xs flex items-center justify-between gap-2"
        >
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* 顶部检索条 + 经纬度精确跳转 + 全球重点枢纽快选 */}
      <div
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-xl border p-3.5 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col xl:flex-row gap-2.5">
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search
                style={{ color: "var(--fg-muted)" }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              />
              <input
                id="geo-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索全球城市、国家、地标或直接输入经纬度（如：东京、Silicon Valley、珠穆朗玛峰）..."
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-full h-9 pl-9 pr-3 rounded-md border text-xs sm:text-sm"
              />
            </div>
            <button
              id="geo-search-btn"
              type="submit"
              disabled={searching}
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--accent-foreground)",
              }}
              className="h-9 px-4 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
            >
              {searching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Compass className="h-3.5 w-3.5" />
              )}
              <span>定位检索</span>
            </button>
          </form>

          <form
            onSubmit={handleCoordJump}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span style={{ color: "var(--fg-muted)" }} className="font-mono">
                Lat
              </span>
              <input
                id="geo-lat-input"
                type="text"
                aria-label="纬度 Latitude"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-24 h-9 px-2.5 rounded-md border font-mono text-xs tabular-nums"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span style={{ color: "var(--fg-muted)" }} className="font-mono">
                Lon
              </span>
              <input
                id="geo-lon-input"
                type="text"
                aria-label="经度 Longitude"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-24 h-9 px-2.5 rounded-md border font-mono text-xs tabular-nums"
              />
            </div>
            <button
              id="geo-coord-go-btn"
              type="submit"
              style={{ backgroundColor: "var(--bg-subtle)" }}
              className="h-9 px-3 rounded-md border font-medium inline-flex items-center gap-1 hover:bg-[var(--bg-hover)] transition-colors shrink-0"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>坐标直达</span>
            </button>
          </form>
        </div>

        {/* 检索候选列表 */}
        {searchResults.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t text-xs">
            <span style={{ color: "var(--fg-muted)" }}>匹配候选：</span>
            {searchResults.slice(0, 6).map((cand) => (
              <button
                key={cand.id}
                type="button"
                onClick={() => {
                  void selectCoordinates(cand.latitude, cand.longitude, true);
                  setSearchResults([]);
                }}
                style={{ backgroundColor: "var(--bg-subtle)" }}
                className="px-2.5 py-1 rounded-md border hover:border-[var(--accent-primary)] transition-colors text-left"
              >
                <span className="font-medium">{cand.name}</span>
                <span
                  style={{ color: "var(--fg-muted)" }}
                  className="ml-1.5 font-mono text-[11px]"
                >
                  {cand.countryCode}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 快捷世界枢纽胶囊 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span style={{ color: "var(--fg-muted)" }} className="mr-1">
            快速节点跳转：
          </span>
          {QUICK_HUB_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-quick-hub={preset.label}
              onClick={() => void selectCoordinates(preset.lat, preset.lon, true)}
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="px-2.5 py-1 rounded-md border hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主工作区双栏：左侧交互式全球地图画布，右侧地点详情与三源 AI 空间问答 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 左侧地图主视窗 (7 列) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="rounded-xl border overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
          >
            {/* 地图顶栏控制条 */}
            <div className="px-3.5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Globe2
                  style={{ color: "var(--accent-primary)" }}
                  className="h-4 w-4 shrink-0"
                />
                <span className="font-medium">
                  点击地图任意位置即可拾取经纬度并逆向识别行政区
                </span>
                {loadingReverse && (
                  <Loader2
                    style={{ color: "var(--accent-primary)" }}
                    className="h-3.5 w-3.5 animate-spin"
                  />
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="放大地图"
                  onClick={() => handleZoomStep(1)}
                  style={{ backgroundColor: "var(--bg-subtle)" }}
                  className="p-1.5 rounded border hover:bg-[var(--bg-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="缩小地图"
                  onClick={() => handleZoomStep(-1)}
                  style={{ backgroundColor: "var(--bg-subtle)" }}
                  className="p-1.5 rounded border hover:bg-[var(--bg-hover)]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="复位全球视图"
                  onClick={handleResetWorldView}
                  style={{ backgroundColor: "var(--bg-subtle)" }}
                  className="px-2 py-1 rounded border inline-flex items-center gap-1 hover:bg-[var(--bg-hover)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>全球</span>
                </button>
              </div>
            </div>

            {/* 地图交互画布 */}
            <div
              id="geo-map-canvas"
              data-render-engine={renderEngine}
              className="relative w-full h-[340px] sm:h-[430px] select-none overflow-hidden"
            >
              <div
                className="absolute inset-0"
                style={{ visibility: renderEngine === "maplibre_webgl" ? "visible" : "hidden" }}
              >
                <div ref={mapContainerRef} className="h-full w-full" />
              </div>

              {renderEngine === "svg_atlas" && (
                <svg
                  id="geo-svg-atlas"
                  viewBox={svgViewBox}
                  preserveAspectRatio="none"
                  onPointerDown={(e) => {
                    if (!e.isPrimary) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = { x: e.clientX, y: e.clientY, ...svgCenter, moved: false };
                  }}
                  onPointerMove={(e) => {
                    const start = drag.current;
                    if (!e.isPrimary || !start || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                    const dx = e.clientX - start.x, dy = e.clientY - start.y;
                    if (Math.hypot(dx, dy) < 4 && !start.moved) return;
                    start.moved = true;
                    const box = e.currentTarget.getBoundingClientRect();
                    const halfWidth = 180 / svgZoom, halfHeight = 90 / svgZoom;
                    setSvgCenter({
                      lon: Math.max(-180 + halfWidth, Math.min(180 - halfWidth, start.lon - dx * 2 * halfWidth / box.width)),
                      lat: Math.max(-90 + halfHeight, Math.min(90 - halfHeight, start.lat + dy * 2 * halfHeight / box.height)),
                    });
                  }}
                  onClick={handleSvgAtlasClick}
                  style={{
                    backgroundColor:
                      theme === "dark" ? "#08111f" : "#dbeafe",
                  }}
                  className="absolute inset-0 w-full h-full cursor-crosshair block touch-none"
                  aria-label="可交互世界地图"
                >
                  {/* 经纬网格线 */}
                  {[-60, -30, 0, 30, 60].map((lat) => (
                    <line
                      key={`lat-${lat}`}
                      x1={0}
                      x2={360}
                      y1={90 - lat}
                      y2={90 - lat}
                      stroke={
                        lat === 0
                          ? theme === "dark"
                            ? "rgba(56,189,248,0.4)"
                            : "rgba(3,105,161,0.35)"
                          : theme === "dark"
                            ? "rgba(148,163,184,0.16)"
                            : "rgba(71,85,105,0.16)"
                      }
                      strokeWidth={lat === 0 ? 0.8 / svgZoom : 0.45 / svgZoom}
                    />
                  ))}
                  {[-120, -60, 0, 60, 120].map((lon) => (
                    <line
                      key={`lon-${lon}`}
                      x1={lon + 180}
                      x2={lon + 180}
                      y1={0}
                      y2={180}
                      stroke={
                        lon === 0
                          ? theme === "dark"
                            ? "rgba(56,189,248,0.4)"
                            : "rgba(3,105,161,0.35)"
                          : theme === "dark"
                            ? "rgba(148,163,184,0.16)"
                            : "rgba(71,85,105,0.16)"
                      }
                      strokeWidth={lon === 0 ? 0.8 / svgZoom : 0.45 / svgZoom}
                    />
                  ))}

                  <image href="/atlas/world.svg" width="360" height="180" />
                  {/* 全球参考枢纽点 */}
                  {WORLD_ATLAS_GAZETTEER.map((hub) => (
                    <circle
                      key={hub.id}
                      cx={hub.longitude + 180}
                      cy={90 - hub.latitude}
                      r={1.6 / svgZoom}
                      fill={theme === "dark" ? "#38bdf8" : "#0369a1"}
                      opacity={0.75}
                    />
                  ))}

                  {/* 已收藏地点星标点 */}
                  {savedPlaces.map((sp) => (
                    <circle
                      key={sp.id}
                      cx={sp.longitude + 180}
                      cy={90 - sp.latitude}
                      r={2.5 / svgZoom}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={0.7 / svgZoom}
                    />
                  ))}

                  {/* 当前选中坐标靶心 */}
                  <g
                    transform={`translate(${selectedPlace.longitude + 180}, ${
                      90 - selectedPlace.latitude
                    })`}
                  >
                    <circle
                      r={5.5 / svgZoom}
                      fill="rgba(2,132,199,0.22)"
                    />
                    <circle
                      r={2.6 / svgZoom}
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth={0.9 / svgZoom}
                    />
                  </g>
                </svg>
              )}

              {/* 左下角实时坐标读数浮层 */}
              <div
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-strong)",
                }}
                className="absolute left-3 bottom-3 px-2.5 py-1.5 rounded-md border text-[11px] font-mono tabular-nums shadow-sm"
              >
                <span>
                  WGS84: {selectedPlace.latitude.toFixed(4)}°,{" "}
                  {selectedPlace.longitude.toFixed(4)}°
                </span>
              </div>

              {/* 右下角开放地理数据合规署名 */}
              <div
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--fg-muted)",
                }}
                className="absolute right-1 bottom-1 px-1.5 py-0.5 rounded text-[9px]"
              >
                Natural Earth · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
              </div>
            </div>
          </div>

          {/* 收藏地点 / 多点对比 / 历史查询 选项卡面板 */}
          <div
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="rounded-xl border p-4 space-y-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div
              role="tablist"
              aria-label="空间数据管理面板"
              className="flex flex-wrap items-center gap-1.5 border-b pb-2.5 text-xs"
            >
              <button
                type="button"
                id="geo-tab-saved"
                role="tab"
                aria-selected={activeBottomTab === "saved"}
                onClick={() => setActiveBottomTab("saved")}
                style={{
                  backgroundColor:
                    activeBottomTab === "saved"
                      ? "var(--accent-primary)"
                      : "var(--bg-subtle)",
                  color:
                    activeBottomTab === "saved"
                      ? "var(--accent-foreground)"
                      : "var(--fg-secondary)",
                }}
                className="px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>收藏地点 ({savedPlaces.length})</span>
              </button>

              <button
                type="button"
                id="geo-tab-compare"
                role="tab"
                aria-selected={activeBottomTab === "compare"}
                onClick={() => setActiveBottomTab("compare")}
                style={{
                  backgroundColor:
                    activeBottomTab === "compare"
                      ? "var(--accent-primary)"
                      : "var(--bg-subtle)",
                  color:
                    activeBottomTab === "compare"
                      ? "var(--accent-foreground)"
                      : "var(--fg-secondary)",
                }}
                className="px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5"
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span>多点对比矩阵 ({compareList.length})</span>
              </button>

              <button
                type="button"
                id="geo-tab-history"
                role="tab"
                aria-selected={activeBottomTab === "history"}
                onClick={() => setActiveBottomTab("history")}
                style={{
                  backgroundColor:
                    activeBottomTab === "history"
                      ? "var(--accent-primary)"
                      : "var(--bg-subtle)",
                  color:
                    activeBottomTab === "history"
                      ? "var(--accent-foreground)"
                      : "var(--fg-secondary)",
                }}
                className="px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                <span>查询历史 ({historyList.length})</span>
              </button>
            </div>

            {activeBottomTab === "saved" && (
              <div id="geo-saved-list" className="space-y-2">
                {savedPlaces.length === 0 ? (
                  <p
                    style={{ color: "var(--fg-muted)" }}
                    className="text-xs py-4 text-center"
                  >
                    暂无收藏地点。在右侧地点卡片中点击「收藏当前地点」即可持久化保存并标注在地图上。
                  </p>
                ) : (
                  savedPlaces.map((sp) => (
                    <div
                      key={sp.id}
                      data-saved-place-name={sp.name}
                      style={{ backgroundColor: "var(--bg-canvas)" }}
                      className="rounded-lg border p-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void selectCoordinates(sp.latitude, sp.longitude, true)
                        }
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="font-semibold truncate hover:text-[var(--accent-primary)]">
                          {sp.name}
                        </div>
                        <div
                          style={{ color: "var(--fg-muted)" }}
                          className="font-mono text-[11px] truncate"
                        >
                          {sp.country || "国际坐标"} · {sp.latitude.toFixed(4)}°,{" "}
                          {sp.longitude.toFixed(4)}°
                          {sp.notes ? ` · 备注：${sp.notes}` : ""}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`删除收藏地点 ${sp.name}`}
                        onClick={() => void handleDeleteSaved(sp)}
                        style={{ color: "var(--fg-muted)" }}
                        className="p-1.5 rounded hover:bg-[var(--danger-bg)] hover:text-[var(--danger-fg)] shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeBottomTab === "compare" && (
              <div id="geo-compare-matrix" className="space-y-2.5">
                {compareList.length < 2 ? (
                  <p
                    style={{ color: "var(--fg-muted)" }}
                    className="text-xs py-3"
                  >
                    当前对比队列有 {compareList.length}{" "}
                    个地点。请切换到另一座城市后点击右侧「加入多点对比」，系统将自动计算球面大圆距离（Haversine）与时区跨度。
                  </p>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        style={{ color: "var(--fg-muted)" }}
                        className="border-b font-mono text-[11px]"
                      >
                        <th className="py-2 pr-3">地点名称</th>
                        <th className="py-2 pr-3">国家 / 辖区</th>
                        <th className="py-2 pr-3">WGS84 坐标</th>
                        <th className="py-2 pr-3">距首项大圆距离</th>
                        <th className="py-2">移除</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {compareList.map((item, idx) => {
                        const base = compareList[0]!;
                        const distKm =
                          idx === 0
                            ? 0
                            : computeHaversineKm(
                                base.latitude,
                                base.longitude,
                                item.latitude,
                                item.longitude
                              );
                        return (
                          <tr key={item.key}>
                            <td className="py-2 pr-3 font-medium">
                              {item.name}
                            </td>
                            <td
                              style={{ color: "var(--fg-secondary)" }}
                              className="py-2 pr-3"
                            >
                              {item.country} · {item.adminArea}
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums">
                              {item.latitude.toFixed(2)}°,{" "}
                              {item.longitude.toFixed(2)}°
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums">
                              {idx === 0 ? "基准点 (0 km)" : `${distKm.toLocaleString()} km`}
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setCompareList((prev) =>
                                    prev.filter((p) => p.key !== item.key)
                                  )
                                }
                                style={{ color: "var(--fg-muted)" }}
                                className="hover:text-[var(--danger-fg)]"
                              >
                                移除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeBottomTab === "history" && (
              <div id="geo-history-list" className="space-y-2">
                {historyList.length === 0 ? (
                  <p
                    style={{ color: "var(--fg-muted)" }}
                    className="text-xs py-4 text-center"
                  >
                    暂无空间问答历史。在右侧提交一次地理提问后将自动记录在此处。
                  </p>
                ) : (
                  historyList.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() =>
                        void selectCoordinates(h.latitude, h.longitude, true)
                      }
                      style={{ backgroundColor: "var(--bg-canvas)" }}
                      className="w-full text-left rounded-lg border p-2.5 space-y-1 hover:border-[var(--accent-primary)] transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">
                          {h.placeName}
                        </span>
                        <span
                          style={{ color: "var(--fg-muted)" }}
                          className="font-mono text-[11px] shrink-0"
                        >
                          {h.createdAt.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <div
                        style={{ color: "var(--fg-secondary)" }}
                        className="truncate"
                      >
                        问：{h.prompt}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {lastExportPreview && (
              <div
                id="geo-export-preview"
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="rounded-lg border p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    <span>最近导出预览 ({lastExportPreview.format})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLastExportPreview(null)}
                    style={{ color: "var(--fg-muted)" }}
                    className="hover:underline"
                  >
                    收起预览
                  </button>
                </div>
                <pre className="max-h-36 overflow-auto text-[11px] font-mono whitespace-pre-wrap break-all">
                  {lastExportPreview.content.slice(0, 900)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：当前选中地点精密卡片 + 三源隔离 AI 地理分析 (5 列) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 当前地点属性卡 */}
          <section
            id="geo-selected-card"
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="rounded-xl border p-4 space-y-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <MapPin
                    style={{ color: "var(--accent-primary)" }}
                    className="h-4 w-4 shrink-0"
                  />
                  <h2
                    id="geo-selected-name"
                    className="text-base font-semibold truncate"
                  >
                    {selectedPlace.name}
                  </h2>
                </div>
                <p
                  style={{ color: "var(--fg-muted)" }}
                  className="text-xs truncate"
                >
                  {selectedPlace.displayName}
                </p>
              </div>
              <ProvenanceBadge kind="measured" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="p-2.5 rounded-lg border"
              >
                <div style={{ color: "var(--fg-muted)" }} className="text-[11px]">
                  国家 / 地区与代码
                </div>
                <div className="font-medium mt-0.5 truncate">
                  {selectedPlace.country} ({selectedPlace.countryCode})
                </div>
              </div>
              <div
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="p-2.5 rounded-lg border"
              >
                <div style={{ color: "var(--fg-muted)" }} className="text-[11px]">
                  行政区域
                </div>
                <div className="font-medium mt-0.5 truncate">
                  {selectedPlace.adminArea}
                </div>
              </div>
              <div
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="p-2.5 rounded-lg border"
              >
                <div style={{ color: "var(--fg-muted)" }} className="text-[11px]">
                  半球方位
                </div>
                <div className="font-mono font-medium mt-0.5 text-[11px]">
                  {selectedPlace.hemisphere}
                </div>
              </div>
              <div
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="p-2.5 rounded-lg border"
              >
                <div style={{ color: "var(--fg-muted)" }} className="text-[11px]">
                  太阳时区带估算
                </div>
                <div className="font-mono font-medium mt-0.5 text-[11px] truncate">
                  {selectedPlace.timezoneEstimate}
                </div>
              </div>
            </div>

            {selectedPlace.elevationOrTerrain && (
              <div
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--fg-secondary)",
                }}
                className="px-3 py-2 rounded-md text-xs"
              >
                地形高程参考：{selectedPlace.elevationOrTerrain}
              </div>
            )}

            {/* 周边要素列表 */}
            <div className="space-y-1.5">
              <div
                style={{ color: "var(--fg-muted)" }}
                className="text-[11px] font-medium"
              >
                周边关联枢纽与地标距离
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {selectedPlace.nearbyPois.slice(0, 4).map((poi) => (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() =>
                      void selectCoordinates(poi.latitude, poi.longitude, true)
                    }
                    style={{ backgroundColor: "var(--bg-canvas)" }}
                    className="px-2.5 py-1.5 rounded border flex items-center justify-between gap-2 hover:border-[var(--accent-primary)] transition-colors text-left"
                  >
                    <span className="truncate">{poi.name}</span>
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="font-mono text-[11px] tabular-nums shrink-0"
                    >
                      {poi.distanceKm}km
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 收藏备注与多点对比动作 */}
            <div className="pt-2 border-t space-y-2 text-xs">
              <input
                id="geo-save-note-input"
                type="text"
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
                placeholder="可选：为该坐标添加工程备注（如：亚太骨干机房选址）..."
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-full h-8 px-2.5 rounded-md border text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="geo-save-place-btn"
                  disabled={savingPlace}
                  onClick={() => void handleSaveCurrentPlace()}
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--accent-foreground)",
                  }}
                  className="flex-1 h-8 px-3 rounded-md font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{savingPlace ? "保存中..." : "收藏当前地点"}</span>
                </button>
                <button
                  type="button"
                  id="geo-add-compare-btn"
                  onClick={handleAddToCompare}
                  style={{ backgroundColor: "var(--bg-subtle)" }}
                  className="h-8 px-3 rounded-md border font-medium inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  <span>加入多点对比</span>
                </button>
              </div>
            </div>
          </section>

          {/* AI 地理空间自然语言问答面板 */}
          <section
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="rounded-xl border p-4 space-y-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
                  <Sparkles
                    style={{ color: "var(--accent-primary)" }}
                    className="h-4 w-4"
                  />
                  <span>AI 地理分析与空间问答</span>
                </h2>
                <span
                  style={{ color: "var(--fg-muted)" }}
                  className="text-[11px] font-mono"
                >
                  三源严格隔离
                </span>
              </div>
              <p style={{ color: "var(--fg-muted)" }} className="text-xs">
                针对当前选中坐标自由提问，输出严格拆分为「实测坐标要素」「公开信源核验」与「AI 推理结论」。
              </p>
            </div>

            <form onSubmit={handleAskGeoAI} className="space-y-2.5">
              <textarea
                id="geo-ai-question-input"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="针对当前选中地点输入您的地理、气候、交通或工程区位问题..."
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-full p-2.5 rounded-lg border text-xs leading-relaxed resize-y"
              />

              <div className="flex flex-wrap gap-1.5">
                {PRESET_GEO_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuestion(q)}
                    style={{
                      backgroundColor: "var(--bg-subtle)",
                      color: "var(--fg-secondary)",
                    }}
                    className="px-2 py-1 rounded text-[11px] hover:text-[var(--fg-primary)] text-left"
                  >
                    示例 {idx + 1}：{q.slice(0, 18)}...
                  </button>
                ))}
              </div>

              <button
                id="geo-ai-ask-btn"
                type="submit"
                disabled={analyzing}
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "var(--accent-foreground)",
                }}
                className="w-full h-9 rounded-md text-xs font-medium inline-flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在融合空间坐标与公开信源分析...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>生成三源可溯源地理分析</span>
                  </>
                )}
              </button>
            </form>

            {analysisResult && (
              <div id="geo-analysis-output" className="space-y-3 pt-2 border-t text-xs">
                {/* 1. 实测地理要素 */}
                <div
                  id="geo-result-measured"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ProvenanceBadge kind="measured" />
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-mono"
                    >
                      WGS84 / ODbL
                    </span>
                  </div>
                  <p
                    style={{ color: "var(--fg-secondary)" }}
                    className="leading-relaxed"
                  >
                    {analysisResult.measured.summary}
                  </p>
                </div>

                {/* 2. 公开联网核验信源 */}
                <div
                  id="geo-result-verified"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ProvenanceBadge kind="web_verified" />
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-mono"
                    >
                      {analysisResult.webVerified.sources.length} 个公开参考源
                    </span>
                  </div>
                  <p
                    style={{ color: "var(--fg-secondary)" }}
                    className="leading-relaxed"
                  >
                    {analysisResult.webVerified.summary}
                  </p>
                  <div className="space-y-1 pt-1">
                    {analysisResult.webVerified.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent-primary)" }}
                        className="flex items-center justify-between gap-2 hover:underline text-[11px]"
                      >
                        <span className="truncate">{src.title}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* 3. AI 推理结论 */}
                <div
                  id="geo-result-inferred"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ProvenanceBadge kind="ai_inferred" />
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-mono"
                    >
                      {analysisResult.aiInferred.available
                        ? `${analysisResult.aiInferred.provider} · ${analysisResult.aiInferred.model}`
                        : "优雅降级模式"}
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">
                    {analysisResult.aiInferred.analysis}
                  </p>
                  {!analysisResult.aiInferred.available && (
                    <button
                      type="button"
                      onClick={() => setAiDrawerOpen(true)}
                      style={{ color: "var(--accent-primary)" }}
                      className="text-[11px] font-medium hover:underline"
                    >
                      前往配置 BYOK API Key 开启在线模型推理 →
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
