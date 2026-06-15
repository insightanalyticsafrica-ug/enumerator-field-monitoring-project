
import { useEffect, useState } from "react";
import type { Submission } from "@/lib/kobo.functions";
// import regionsAsset from "@/assets/udhs-regions-2019.json.asset.json";
import regionsGeoJSON from "@/assets/uganda_districts_2019-wgs84.json";

type Props = { points: Submission[] };

export function GpsLeafletMap({ points }: Props) {
  const [mounted, setMounted] = useState(false);
  const [Mod, setMod] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  console.log("REGIONS DATA:", regionsGeoJSON);
  const [regions, setRegions] = useState<any>(null);

  
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [rl, leaflet] = await Promise.all([
          import("react-leaflet"),
          import("leaflet"),
          import("leaflet/dist/leaflet.css"),
        ]);

        const geo = regionsGeoJSON;

        if (cancelled) return;

        setMod(rl);
        setL(leaflet);
        setRegions(geo);
        setMounted(true);
      } catch (err) {
        console.error("Map loading failed:", err);
        }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // useEffect(() => {
  //   let cancelled = false;
  //   (async () => {
  //     const [rl, leaflet] = await Promise.all([
  //       import("react-leaflet"),
  //       import("leaflet"),
  //       import("leaflet/dist/leaflet.css"),
  //     ]);
  //     const res = await fetch(regionsAsset.url);
  //     const geo = await res.json();
  //     if (cancelled) return;
  //     setMod(rl);
  //     setL(leaflet);
  //     setRegions(geo);
  //     setMounted(true);
  //   })();
  //   return () => {
  //     cancelled = true;
  //   };
  // }, []);

  if (!mounted || !Mod || !L) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">
        Loading map…
      </div>
    );
  }

  const { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip: LTooltip } = Mod;

  const scoreColor = (s: number) =>
    s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444";

  const center: [number, number] = points.length
    ? [
        points.reduce((a, p) => a + (p.gps_lat || 0), 0) / points.length,
        points.reduce((a, p) => a + (p.gps_lng || 0), 0) / points.length,
      ]
    : [1.3733, 32.2903];

  const regionStyle = {
    color: "#60a5fa",
    weight: 1,
    fillColor: "#1e3a8a",
    fillOpacity: 0.15,
  };

  return (
    <div className="h-[260px] rounded-md overflow-hidden">
      <MapContainer
        center={center}
        zoom={6}
        style={{ height: "100%", width: "100%", background: "#0b1220" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {regions && (
          <GeoJSON
            data={regions}
            style={() => regionStyle}
            onEachFeature={(feature: any, layer: any) => {
              const p = feature.properties || {};
              layer.bindTooltip(
                `<strong>${p.Name || p.F15Regions || "Region"}</strong><br/>${p.Dname2016 || ""}`,
                { sticky: true },
              );
            }}
          />
        )}
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.gps_lat!, p.gps_lng!]}
            radius={5}
            pathOptions={{
              color: scoreColor(p.quality_score),
              fillColor: scoreColor(p.quality_score),
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <LTooltip>
              <div className="text-xs">
                <div><strong>{p.enumerator_id}</strong></div>
                <div>{p.district}</div>
                <div>Score: {p.quality_score}%</div>
              </div>
            </LTooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
