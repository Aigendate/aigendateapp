"use client";

import { Fragment } from "react";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/16/solid";
import { cn } from "~/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

function ListboxSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={cn("relative", className)}>
        <ListboxButton className="relative w-full cursor-pointer border border-border bg-card py-1.5 pl-3 pr-8 text-left font-mono text-[0.75rem] transition-colors focus:border-primary focus:outline-none">
          <span className={cn("block truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronUpDownIcon className="group pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </ListboxButton>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions
            anchor="bottom start"
            className="z-[100] mt-1 max-h-60 w-[var(--button-width)] overflow-auto border border-border bg-card py-1 font-mono text-[0.75rem] shadow-sm focus:outline-none"
          >
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className="group relative cursor-pointer select-none py-1.5 pl-8 pr-3 text-foreground data-[focus]:bg-muted data-[focus]:text-foreground"
              >
                {({ selected: isSelected }) => (
                  <>
                    <span className={cn("block truncate", isSelected && "font-medium")}>
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="block truncate text-[0.65rem] text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                    {isSelected && (
                      <CheckIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-primary" />
                    )}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

export { ListboxSelect };
export type { SelectOption };