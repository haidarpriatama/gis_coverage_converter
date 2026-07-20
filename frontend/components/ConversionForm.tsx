"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  FileSpreadsheet,
  Settings,
  AlertCircle,
  Globe,
  MapPin,
  Layers,
  Loader2,
} from "lucide-react";

import { ColumnMapper } from "@/components/ColumnMapper";
import { ConversionSummary } from "@/components/ConversionSummary";
import { CsvUploader } from "@/components/CsvUploader";
import { DownloadButton } from "@/components/DownloadButton";
import { GoogleDriveButton } from "@/components/GoogleDriveButton";
import { CsvTablePreviewModal } from "@/components/CsvTablePreviewModal";
import { convertCsv, inspectCsvWithProgress, saveBlob } from "@/lib/api";
import type { DriveDownloadProgress } from "@/lib/google-drive";
import type { ConversionSummaryData, CsvInspection, RequestProgress, UiStatus } from "@/lib/types";
import {
  conversionSchema,
  csvFileSchema,
  type ConversionFormValues,
} from "@/lib/validation";

const statusLabels: Record<UiStatus, string> = {
  initial: "Silakan unggah file CSV untuk memulai",
  uploading: "Mengunggah file CSV...",
  inspecting: "Membaca struktur file...",
  ready: "Siap dikonversi. Silakan pilih format output.",
  converting: "Membuat grid 153m...",
  "download-ready": "Konversi selesai! File otomatis terunduh.",
  error: "Periksa kembali input file dan pilihan kolom Anda.",
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
  return `${fileSizeLabel(progress.loaded)} dari ${fileSizeLabel(progress.total)} terunggah`;
}

function ProgressPanel({ progress }: { progress: ProgressState }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium text-slate-800 flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-slate-700 shrink-0" />
          {progress.label}
        </span>
        <span className="font-mono text-slate-600 font-semibold">
          {progress.percent === null ? "Memproses..." : `${progress.percent}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        {progress.percent === null ? (
          <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-900" />
        ) : (
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-200"
            style={{ width: `${progress.percent}%` }}
          />
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500 font-mono">{progress.detail}</p>
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
    setProgress({ label: "Mengunggah CSV untuk diperiksa", detail: "Memulai unggahan", percent: 0 });

    const validated = csvFileSchema.safeParse(nextFile);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "File CSV tidak valid.");
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
            label: "Mengunggah CSV untuk diperiksa",
            detail: progressDetail(uploadProgress),
            percent: uploadProgress.percent,
          });
        },
        () => {
          setProgress({
            label: "Membaca struktur CSV",
            detail: "Mendeteksi delimiter, membaca header, dan menghitung baris",
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
      setError(reason instanceof Error ? reason.message : "CSV tidak dapat diperiksa.");
      setStatus("error");
      setProgress(null);
    }
  }

  function handleDriveProgress(driveProgress: DriveDownloadProgress) {
    setStatus("uploading");
    setError(null);
    setProgress({
      label: "Mengambil CSV dari Google Drive",
      detail: driveProgress.total
        ? `${fileSizeLabel(driveProgress.loaded)} dari ${fileSizeLabel(driveProgress.total)} terunduh`
        : `${fileSizeLabel(driveProgress.loaded)} terunduh`,
      percent: driveProgress.percent,
    });
  }

  function handleDriveError(message: string) {
    setError(message);
    setStatus("error");
    setProgress(null);
  }

  const onSubmit = handleSubmit(async (formValues) => {
    if (!file) return;
    setStatus("converting");
    setError(null);
    setSummary(null);
    setProgress({ label: "Mengunggah CSV untuk dikonversi", detail: "Memulai unggahan", percent: 0 });
    try {
      const result = await convertCsv(file, formValues, {
        onUploadProgress: (uploadProgress) => {
          setProgress({
            label: "Mengunggah CSV untuk dikonversi",
            detail: progressDetail(uploadProgress),
            percent: uploadProgress.percent,
          });
        },
        onProcessingStart: () => {
          setProgress({
            label: "Mengonversi CSV ke Polygon Grid",
            detail: "Memvalidasi koordinat WGS84, proyeksi UTM, dan menulis file hasil",
            percent: null,
          });
        },
      });
      setProgress({ label: "Menyiapkan unduhan", detail: "Menyimpan file hasil ke komputer Anda", percent: 100 });
      saveBlob(result.blob, result.summary.filename);
      setSummary(result.summary);
      setStatus("download-ready");
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Konversi gagal.");
      setStatus("error");
      setProgress(null);
    }
  });

  return (
    <form onSubmit={onSubmit} className="w-full">
      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: File Source & Inspection (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-slate-700" />
                Sumber Data
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah file dari perangkat atau Google Drive
              </p>
            </div>

            {inspection && file ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{inspection.filename}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{fileSizeLabel(file.size)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 text-center font-mono">
                    <div className="rounded-md bg-white border border-slate-200 p-2">
                      <p className="text-sm font-bold text-slate-900">{inspection.total_rows.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-sans">Total Baris</p>
                    </div>
                    <div className="rounded-md bg-white border border-slate-200 p-2">
                      <p className="text-sm font-bold text-slate-900">{inspection.columns.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-sans">Jumlah Kolom</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <CsvTablePreviewModal file={file} columns={inspection.columns} />
                    <CsvUploader compact file={file} busy={busy} onFile={handleFile} />
                  </div>
                </div>

                <GoogleDriveButton
                  disabled={busy}
                  onFile={handleFile}
                  onError={handleDriveError}
                  onProgress={handleDriveProgress}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <CsvUploader file={file} busy={busy} onFile={handleFile} />

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                  <span className="h-px flex-1 bg-slate-200" />
                  ATAU
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <GoogleDriveButton
                  disabled={busy}
                  onFile={handleFile}
                  onError={handleDriveError}
                  onProgress={handleDriveProgress}
                />
              </div>
            )}

            {progress && <ProgressPanel progress={progress} />}

            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Gagal Memproses File</p>
                  <p className="mt-0.5 text-red-700">{error}</p>
                </div>
              </div>
            )}

            {summary && <ConversionSummary summary={summary} />}
          </div>
        </section>

        {/* Right Column: Configuration & Options (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col flex-1">
            <div className="mb-5 border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Settings className="size-4 text-slate-700" />
                Konfigurasi Konversi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih kolom koordinat dan format hasil yang dibutuhkan
              </p>
            </div>

            <div className="space-y-5">
              {/* Column Mapping */}
              <fieldset disabled={!inspection || busy}>
                <div className="mb-2.5">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    Pemetaan Kolom
                  </legend>
                </div>

                {inspection ? (
                  <ColumnMapper
                    columns={inspection.columns}
                    suggestedColumns={inspection.suggested_columns}
                    register={register}
                    errors={errors}
                    disabled={busy}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
                    Pilihan kolom akan aktif setelah file CSV dipilih.
                  </div>
                )}
              </fieldset>

              {/* Output Format */}
              <fieldset disabled={!inspection || busy} className="border-t border-slate-100 pt-5">
                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                  <Layers className="size-3.5" />
                  Pengaturan Output
                </legend>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: "kml",
                      title: "KML",
                      subtitle: "Google Earth",
                      desc: "Format Google Earth",
                    },
                    {
                      value: "gpkg",
                      title: "GPKG",
                      subtitle: "QGIS",
                      desc: "Format GeoPackage QGIS",
                    },
                  ].map((format) => (
                    <label key={format.value} className="relative cursor-pointer group">
                      <input
                        {...register("outputFormat")}
                        type="radio"
                        value={format.value}
                        className="peer sr-only"
                      />
                      <div className="rounded-lg border border-slate-200 bg-white p-3.5 transition-all group-hover:border-slate-300 peer-checked:border-slate-900 peer-checked:bg-slate-50 peer-checked:ring-1 peer-checked:ring-slate-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 font-mono">{format.title}</span>
                          <span className="text-[11px] font-medium text-slate-600">{format.subtitle}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">{format.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.outputFormat?.message && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.outputFormat.message}</p>
                )}

                {/* Subtle Inline Grid Specs */}
                <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                  <Globe className="size-3 text-slate-400 shrink-0" />
                  <span>Detail grid: 153m × 153m · Fill 60% · Proyeksi UTM Otomatis</span>
                </p>
              </fieldset>
            </div>

            {/* Bottom Action Footer */}
            <div className="mt-auto pt-5 border-t border-slate-100">
              <DownloadButton disabled={!canConvert} converting={status === "converting"} />
              <p className="mt-2 text-center text-xs text-slate-500">
                {statusLabels[status]}
              </p>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
