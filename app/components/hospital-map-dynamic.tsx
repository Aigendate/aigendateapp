"use client";

import dynamic from "next/dynamic";
import type { MapHospital } from "./hospital-map";

// Leaflet touches `window` at import time, so it must never run during SSR.
const HospitalMap = dynamic(() => import("./hospital-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center border border-border bg-muted/30 text-[0.7rem] uppercase tracking-wider text-muted-foreground" style={{ height: 480 }}>
      Cargando mapa…
    </div>
  ),
});

export function HospitalMapDynamic(props: {
  hospitals: MapHospital[];
  zoom?: number;
  height?: number;
}) {
  return <HospitalMap {...props} />;
}
