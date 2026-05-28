"use client";

import { useEffect } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapHospital {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  lat: number;
  lng: number;
}

// On-brand pin (accent burnt-orange, sharp corners) rendered as a divIcon so we
// don't depend on Leaflet's bundler-broken default marker PNGs.
const pinIcon = L.divIcon({
  className: "hospital-pin",
  html: `<span style="display:block;width:14px;height:14px;background:#C4510A;border:2px solid #1A1A18;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -8],
});

// Center on a single hospital, or fit all pins into view for the overview.
function FitView({ hospitals, zoom }: { hospitals: MapHospital[]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (hospitals.length === 0) return;
    if (hospitals.length === 1) {
      map.setView([hospitals[0].lat, hospitals[0].lng], zoom ?? 14);
      return;
    }
    const bounds = L.latLngBounds(hospitals.map((h) => [h.lat, h.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [hospitals, zoom, map]);
  return null;
}

export default function HospitalMap({
  hospitals,
  zoom,
  height = 480,
}: {
  hospitals: MapHospital[];
  zoom?: number;
  height?: number;
}) {
  // Fallback view: roughly centered on Paraguay.
  const fallback: [number, number] = hospitals.length
    ? [hospitals[0].lat, hospitals[0].lng]
    : [-23.4, -57.0];

  return (
    <div style={{ height }} className="border border-border">
      <MapContainer
        center={fallback}
        zoom={zoom ?? 7}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitView hospitals={hospitals} zoom={zoom} />
        {hospitals.map((h) => (
          <Marker key={h.id} position={[h.lat, h.lng]} icon={pinIcon}>
            <Popup>
              <div className="space-y-1">
                <Link
                  href={`/hospitales/${h.id}`}
                  className="font-medium text-foreground underline"
                >
                  {h.name}
                </Link>
                <div className="text-muted-foreground">{h.address}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
