"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "~/components/ui/input";

interface SearchInputProps {
  paramName?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function SearchInput({
  paramName = "q",
  placeholder,
  defaultValue = "",
  className,
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <Input
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set(paramName, value);
        } else {
          params.delete(paramName);
        }
        const qs = params.toString();
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
      }}
    />
  );
}
