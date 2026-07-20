"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Compass, Navigation, Tag, Layers, ChevronDown } from "lucide-react";
import type { ConversionFormValues } from "@/lib/validation";

interface ColumnMapperProps {
  columns: string[];
  suggestedColumns?: {
    longitude: string | null;
    latitude: string | null;
    name: string | null;
    category: string | null;
  };
  register: UseFormRegister<ConversionFormValues>;
  errors: FieldErrors<ConversionFormValues>;
  disabled: boolean;
}

const fields: Array<{
  name: "longitudeColumn" | "latitudeColumn" | "nameColumn" | "categoryColumn";
  label: string;
  icon: typeof Compass;
  placeholder: string;
  optional?: boolean;
}> = [
  {
    name: "longitudeColumn",
    label: "Kolom Longitude",
    icon: Compass,
    placeholder: "Pilih kolom Longitude (X)",
  },
  {
    name: "latitudeColumn",
    label: "Kolom Latitude",
    icon: Navigation,
    placeholder: "Pilih kolom Latitude (Y)",
  },
  {
    name: "nameColumn",
    label: "Kolom Nama Grid",
    icon: Tag,
    placeholder: "Opsional (cth: geohash)",
    optional: true,
  },
  {
    name: "categoryColumn",
    label: "Kolom Kategori",
    icon: Layers,
    placeholder: "Opsional (cth: category)",
    optional: true,
  },
];

export function ColumnMapper({
  columns,
  register,
  errors,
  disabled,
}: ColumnMapperProps) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {fields.map((field) => {
        const IconComponent = field.icon;

        return (
          <div key={field.name} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={field.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <IconComponent className="size-3.5 text-slate-500" />
                {field.label}
                {field.optional && (
                  <span className="text-[10px] font-normal text-slate-400">
                    (opsional)
                  </span>
                )}
              </label>
            </div>

            <div className="relative">
              <select
                id={field.name}
                {...register(field.name)}
                disabled={disabled}
                className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-slate-50/50 px-3 pr-8 text-xs font-mono text-slate-800 outline-none transition-colors focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{field.placeholder}</option>
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-400" />
            </div>

            {errors[field.name]?.message && (
              <span className="mt-1 block text-[11px] font-medium text-red-600">
                {errors[field.name]?.message}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
