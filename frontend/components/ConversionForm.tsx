"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ColumnMapper } from "@/components/ColumnMapper";
import { ConversionSummary } from "@/components/ConversionSummary";
import { CsvUploader } from "@/components/CsvUploader";
import { DownloadButton } from "@/components/DownloadButton";
import { convertCsv, inspectCsvWithProgress, saveBlob } from "@/lib/api";
import type { ConversionSummaryData, CsvInspection, RequestProgress, UiStatus } from "@/lib/types";
import {
  conversionSchema,
  csvFileSchema,
  type ConversionFormValues,
} from "@/lib/validation";

const statusLabels: Record<UiStatus, string> = {
  initial: "Waiting for CSV",
  uploading: "Uploading CSV",
  inspecting: "Inspecting columns",
  ready: "Ready to convert",
  converting: "Creating polygons",
  "download-ready": "Download complete",
  error: "Needs attention",
};

interface ProgressState {
  label: string;
  detail: string;
  percent: number | null;
}

function fileSizeLabel(size: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function progressDetail(progress: RequestProgress): string {
  return `${fileSizeLabel(progress.loaded)} of ${fileSizeLabel(progress.total)} uploaded`;
}

function ProgressPanel({ progress }: { progress: ProgressState }) {
  return (
    <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-teal-950">{progress.label}</span>
        <span className="shrink-0 font-medium text-teal-700">
          {progress.percent === null ? "Processing" : `${progress.percent}%`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        {progress.percent === null ? (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-600" />
        ) : (
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-teal-800">{progress.detail}</p>
    </div>
  );
}

export function ConversionForm() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<CsvInspection | null>(null);
  const [status, setStatus] = useState<UiStatus>("initial");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversionSummaryData | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

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
    setProgress({
      label: "Uploading CSV for inspection",
      detail: "Starting upload",
      percent: 0,
    });
    const validated = csvFileSchema.safeParse(nextFile);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Invalid CSV file.");
      setStatus("error");
      setProgress(null);
      return;
    }

    setFile(nextFile);
    setStatus("inspecting");
    try {
      const result = await inspectCsvWithProgress(
        nextFile,
        (uploadProgress) => {
          setProgress({
            label: "Uploading CSV for inspection",
            detail: progressDetail(uploadProgress),
            percent: uploadProgress.percent,
          });
        },
        () => {
          setProgress({
            label: "Reading CSV structure",
            detail: "Detecting delimiter, reading header, and counting rows",
            percent: null,
          });
        },
      );
      setInspection(result);
      reset({
        longitudeColumn: result.suggested_columns.longitude ?? "",
        latitudeColumn: result.suggested_columns.latitude ?? "",
        nameColumn: result.suggested_columns.name ?? "",
        categoryColumn: result.suggested_columns.category ?? "",
        outputFormat: undefined,
      });
      setStatus("ready");
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The CSV could not be inspected.");
      setStatus("error");
      setProgress(null);
    }
  }

  const onSubmit = handleSubmit(async (formValues) => {
    if (!file) return;
    setStatus("converting");
    setError(null);
    setSummary(null);
    setProgress({
      label: "Uploading CSV for conversion",
      detail: "Starting upload",
      percent: 0,
    });
    try {
      const result = await convertCsv(file, formValues, {
        onUploadProgress: (uploadProgress) => {
          setProgress({
            label: "Uploading CSV for conversion",
            detail: progressDetail(uploadProgress),
            percent: uploadProgress.percent,
          });
        },
        onProcessingStart: () => {
          setProgress({
            label: "Converting CSV",
            detail: "Validating coordinates, building 153 m grids, and writing output",
            percent: null,
          });
        },
      });
      setProgress({
        label: "Preparing download",
        detail: "Saving the generated file to your browser",
        percent: 100,
      });
      saveBlob(result.blob, result.summary.filename);
      setSummary(result.summary);
      setStatus("download-ready");
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed.");
      setStatus("error");
      setProgress(null);
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

        {progress && <ProgressPanel progress={progress} />}

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
