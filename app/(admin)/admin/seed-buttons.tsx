"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { scrapeAndSeed, deleteAllData } from "./actions";

export function SeedButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleScrape() {
    if (!confirm("Esto va a correr el scraper de OpenStreetMap, borrar los datos actuales y recargarlos. Puede tardar ~1 minuto. Continuar?")) return;
    setLoading("scrape");
    setResult({ ok: true, message: "Ejecutando scraper de OpenStreetMap..." });
    const res = await scrapeAndSeed();
    setResult(res);
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm("Esto va a BORRAR todos los datos (hospitales, doctores, pacientes, turnos). Continuar?")) return;
    setLoading("delete");
    setResult(null);
    const res = await deleteAllData();
    setResult(res);
    setLoading(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          onClick={handleScrape}
          disabled={loading !== null}
        >
          {loading === "scrape" ? "Scrapeando..." : "Scrape OpenStreetMap + Importar"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading !== null}
        >
          {loading === "delete" ? "Borrando..." : "Borrar todos los datos"}
        </Button>
      </div>
      {result && (
        <div className={`text-[0.7rem] ${!result.ok ? "text-destructive" : "text-primary"}`}>
          {loading === "scrape" && (
            <span className="mr-2 inline-block h-3 w-3 animate-spin border-2 border-current border-t-transparent" style={{ borderRadius: "50%" }} />
          )}
          {result.message}
        </div>
      )}
    </div>
  );
}
