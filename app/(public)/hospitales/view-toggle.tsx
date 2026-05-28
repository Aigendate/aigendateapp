"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { HospitalMapDynamic } from "~/components/hospital-map-dynamic";
import type { MapHospital } from "~/components/hospital-map";

export interface HospitalView extends MapHospital {
  address: string;
}

// Groups arrive pre-built from the server so the list view is instant; the map
// view lazy-loads Leaflet only when selected.
export function HospitalsView({
  groups,
}: {
  groups: { city: string; hospitals: HospitalView[] }[];
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const all = groups.flatMap((g) => g.hospitals);

  return (
    <div>
      <div className="mb-4 flex gap-0 border border-border text-[0.7rem] uppercase tracking-wider">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "flex-1 px-3 py-1.5 transition-colors",
              view === v
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {v === "list" ? "Lista" : "Mapa"}
          </button>
        ))}
      </div>

      {view === "map" ? (
        <HospitalMapDynamic hospitals={all} />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.city}>
              <div className="mb-2 flex items-baseline gap-2 border-b border-muted pb-1">
                <span className="text-[0.7rem] font-medium uppercase tracking-wider">
                  {group.city}
                </span>
                <Badge variant="outline">{group.hospitals.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                {group.hospitals.map((h) => (
                  <Link
                    key={h.id}
                    href={`/hospitales/${h.id}`}
                    className="border-b border-muted px-3 py-2 text-[0.75rem] transition-colors hover:bg-muted/50"
                  >
                    <div className="font-medium">{h.name}</div>
                    <div className="text-[0.65rem] text-muted-foreground">{h.address}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
