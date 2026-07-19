"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ColumnMapper } from "@/components/ColumnMapper";
import { ConversionSummary } from "@/components/ConversionSummary";
import { CsvUploader } from "@/components/CsvUploader";
import { DownloadButton } from "@/components/DownloadButton";
import { convertCsv, inspectCsv, saveBlob } from "@/lib/api";
import type { ConversionSummaryData, CsvInspection, UiStatus } from "@/lib/types";
import {
  conversionSchema,
  csvFileSchema,
  type ConversionFormValues,
} from "@/lib/validation";

const statusLabels: Record<UiStatus, string> = {
  initial: "Waiting for CSV",
  uploading: "Reading file",
  inspecting: "Inspecting columns",
  ready: "Ready to convert",
  converting: "Creating polygons",
  "download-ready": "Download complete",
  error: "Needs attention",
};

export function ConversionForm() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<CsvInspection | null>(null);
  const [status, setStatus] = useState<UiStatus>("initial");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversionSummaryData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ConversionFormValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      longitudeColumn: "",
      latitudeColumn: "",
      nameColumn: "",
      categoryColumn: "",
    },
  });

  const busy = status === "uploading" || status === "inspecting" || status === "converting";
  const values = useWatch({ control });
  const canConvert = Boolean(
    file &&
      inspection &&
      values.longitudeColumn &&
      values.latitudeColumn &&
      values.outputFormat &&
      !busy,
  );

  async function handleFile(nextFile: File) {
    setStatus("uploading");
    setError(null);
    setSummary(null);
    setInspection(null);
    setFile(null);
    const validated = csvFileSchema.safeParse(nextFile);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Invalid CSV file.");
      setStatus("error");
      return;
    }

    setFile(nextFile);
    setStatus("inspecting");
    try {
      const result = await inspectCsv(nextFile);
      setInspection(result);
      reset({
        longitudeColumn: result.suggested_columns.longitude ?? "",
        latitudeColumn: result.suggested_columns.latitude ?? "",
        nameColumn: result.suggested_columns.name ?? "",
        categoryColumn: result.suggested_columns.category ?? "",
        outputFormat: undefined,
      });
      setStatus("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The CSV could not be inspected.");
      setStatus("error");
    }
  }

  const onSubmit = handleSubmit(async (formValues) => {
    if (!file) return;
    setStatus("converting");
    setError(null);
    setSummary(null);
    try {
      const result = await convertCsv(file, formValues);
      saveBlob(result.blob, result.summary.filename);
      setSummary(result.summary);
      setStatus("download-ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed.");
      setStatus("error");
    }
  });

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span className={`size-2 rounded-full ${status === "error" ? "bg-red-500" : busy ? "animate-pulse bg-amber-500" : status === "download-ready" ? "bg-emerald-500" : "bg-teal-600"}`} />
          {statusLabels[status]}
        </div>
        <span className="text-xs font-medium text-slate-400">No data is stored</span>
      </div>

      <div className="p-6 sm:p-8">
        <CsvUploader file={file} busy={busy} onFile={handleFile} />

        {file && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="size-4 shrink-0 text-teal-700" aria-hidden="true">
                <path d="M5 2.5h6l4 4V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
                <path d="M11 2.5v4h4" />
              </svg>
              <span className="truncate">{file.name}</span>
            </span>
            {inspection && <span className="text-slate-500">{inspection.total_rows.toLocaleString()} rows found</span>}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="mt-0.5 font-black">!</span>
            <p>{error}</p>
          </div>
        )}

        {inspection && (
          <div className="mt-8 space-y-8">
            <section>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-700">1</span>
                <h2 className="font-bold text-slate-950">Map your columns</h2>
              </div>
              <ColumnMapper columns={inspection.columns} register={register} errors={errors} disabled={busy} />
            </section>

            <section className="border-t border-slate-100 pt-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-700">2</span>
                <h2 className="font-bold text-slate-950">Grid settings</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[["Width", "153", "meters"], ["Height", "153", "meters"], ["Fill opacity", "0.6", "60 percent"]].map(([label, value, unit]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-1 font-bold text-slate-900">{value} <span className="text-xs font-normal text-slate-400">{unit}</span></p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                {[
                  ["#00B050", "Bad Non Potential"],
                  ["#0000FF", "Not Red Cov"],
                  ["#FF0000", "Red Engineering"],
                  ["#FFFF00", "Red Optim"],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>
            </section>

            <fieldset className="border-t border-slate-100 pt-8" disabled={busy}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-lg bg-teal-50 text-xs font-extrabold text-teal-700">3</span>
                <legend className="font-bold text-slate-950">Choose output format</legend>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "kml", title: "KML", detail: "For Google Earth", badge: ".kml" },
                  { value: "gpkg", title: "GeoPackage", detail: "For QGIS", badge: ".gpkg" },
                  { value: "qgis", title: "QGIS map package", detail: "Google Satellite included", badge: ".zip" },
                ].map((format) => (
                  <label key={format.value} className="relative cursor-pointer">
                    <input {...register("outputFormat")} type="radio" value={format.value} className="peer sr-only" />
                    <span className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 peer-checked:border-teal-600 peer-checked:bg-teal-50/60 peer-checked:ring-1 peer-checked:ring-teal-600">
                      <span className="grid size-10 place-items-center rounded-lg bg-slate-100 font-mono text-[10px] font-bold text-slate-600 peer-checked:bg-white">{format.badge}</span>
                      <span className="flex-1"><span className="block text-sm font-bold text-slate-900">{format.title}</span><span className="block text-xs text-slate-500">{format.detail}</span></span>
                      <span className="size-4 rounded-full border border-slate-300 bg-white ring-4 ring-white peer-checked:border-[5px] peer-checked:border-teal-600" />
                    </span>
                  </label>
                ))}
              </div>
              {errors.outputFormat?.message && <p className="mt-2 text-xs font-medium text-red-600">{errors.outputFormat.message}</p>}
            </fieldset>

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-5 text-slate-500">Each valid CSV row becomes one 153 m × 153 m polygon centered on its longitude and latitude.</p>
              <DownloadButton disabled={!canConvert} converting={status === "converting"} />
            </div>
          </div>
        )}

        {summary && <ConversionSummary summary={summary} />}
      </div>
    </form>
  );
}
