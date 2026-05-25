"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "~/components/ui/input";

interface TurnosFiltersProps {
  defaultDate: string;
  defaultStatus: string;
}

export function TurnosFilters({ defaultDate, defaultStatus }: TurnosFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="mb-4 flex gap-3">
      <Input
        type="date"
        defaultValue={defaultDate}
        className="w-auto"
        onChange={(e) => update("date", e.target.value)}
      />
      <select
        className="border border-border bg-background px-3 py-2 font-mono text-[0.8rem] outline-none focus:border-primary"
        defaultValue={defaultStatus}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">Todos</option>
        <option value="scheduled">Activos</option>
        <option value="cancelled">Cancelados</option>
      </select>
    </div>
  );
}
