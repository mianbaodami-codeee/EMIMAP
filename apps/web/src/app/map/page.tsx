import type { Metadata } from "next";
import { PLATFORM_MODULES } from "@omnikit/shared";
import {
  listGeoQueryHistory,
  listSavedPlaces,
  reverseGeocodeCoordinate,
} from "@/lib/geo/service";
import { resolveClientWorkspaceId } from "@/lib/session/client-id";
import { MapWorkspace } from "@/components/map/map-workspace";

export const dynamic = "force-dynamic";

const mod = PLATFORM_MODULES.find((m) => m.id === "map")!;

export const metadata: Metadata = {
  title: mod.name,
  description: mod.summary,
};

export default async function GlobalMapPage() {
  const { clientId } = await resolveClientWorkspaceId();
  const [initialPlace, initialSavedPlaces, initialHistory] = await Promise.all([
    reverseGeocodeCoordinate(31.2304, 121.4737),
    listSavedPlaces(clientId),
    listGeoQueryHistory(clientId, 20),
  ]);

  return (
    <MapWorkspace
      initialPlace={initialPlace}
      initialSavedPlaces={initialSavedPlaces}
      initialHistory={initialHistory}
    />
  );
}
