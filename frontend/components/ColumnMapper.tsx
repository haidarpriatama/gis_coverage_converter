"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ConversionFormValues } from "@/lib/validation";

interface ColumnMapperProps {
  columns: string[];
  register: UseFormRegister<ConversionFormValues>;
  errors: FieldErrors<ConversionFormValues>;
  disabled: boolean;
}

const fields: Array<{
  name: "longitudeColumn" | "latitudeColumn" | "nameColumn" | "categoryColumn";
  label: string;
  optional?: boolean;
}> = [
  { name: "longitudeColumn", label: "Longitude column" },
  { name: "latitudeColumn", label: "Latitude column" },
  { name: "nameColumn", label: "Grid name column", optional: true },
  { name: "categoryColumn", label: "Category column", optional: true },
];

export function ColumnMapper({ columns, register, errors, disabled }: ColumnMapperProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((field) => (
        <label key={field.name} className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            {field.label}
            {field.optional && (
              <span className="text-xs font-normal text-slate-400">optional</span>
            )}
          </span>
          <span className="relative block">
            <select
              {...register(field.name)}
              disabled={disabled}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:bg-slate-100"
            >
              <option value="">{field.optional ? "Not selected" : "Select a column"}</option>
              {columns.map((column) => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-3 top-3 size-5 text-slate-400" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </span>
          {errors[field.name]?.message && (
            <span className="mt-1.5 block text-xs font-medium text-red-600">
              {errors[field.name]?.message}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
