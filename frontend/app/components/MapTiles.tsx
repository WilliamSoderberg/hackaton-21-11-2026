"use client";

// Base map tiles. The public OpenStreetMap tile servers block apps that don't
// follow their usage policy (403 "Access blocked"), and CARTO basemaps now
// return an "API key required" placeholder, so we use Esri's key-free World
// Street Map and fall back to Esri World Topo if tiles keep failing.
import { useRef, useState } from "react";
import { TileLayer } from "react-leaflet";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const PROVIDERS = [
  {
    url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
  },
  {
    url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
  },
];

export default function MapTiles() {
  const [index, setIndex] = useState(0);
  const errors = useRef(0);
  const p = PROVIDERS[index];
  return (
    <TileLayer
      key={p.url}
      url={p.url}
      attribution={p.attribution}
      maxZoom={19}
      eventHandlers={{
        tileerror: () => {
          errors.current += 1;
          if (errors.current >= 4 && index < PROVIDERS.length - 1) {
            errors.current = 0;
            setIndex(index + 1);
          }
        },
      }}
    />
  );
}
