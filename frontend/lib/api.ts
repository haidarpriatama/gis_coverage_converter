import type {
  ConversionRequest,
  ConversionSummaryData,
  CsvInspection,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // The server may return an empty or non-JSON error response.
  }
  return `Request failed with status ${response.status}.`;
}

export async function inspectCsv(file: File): Promise<CsvInspection> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/csv/inspect`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as CsvInspection;
}

function downloadFilename(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=utf-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];
  return "coverage_grid";
}

export async function convertCsv(
  file: File,
  request: ConversionRequest,
): Promise<{ blob: Blob; summary: ConversionSummaryData }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("longitude_column", request.longitudeColumn);
  formData.append("latitude_column", request.latitudeColumn);
  formData.append("name_column", request.nameColumn ?? "");
  formData.append("category_column", request.categoryColumn ?? "");
  formData.append("output_format", request.outputFormat);
  formData.append("grid_width_m", "153");
  formData.append("grid_height_m", "153");
  formData.append("fill_opacity", "0.6");

  const response = await fetch(`${API_BASE_URL}/api/convert`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error(await errorMessage(response));

  const totalRows = Number(response.headers.get("x-total-rows") ?? 0);
  const validRows = Number(response.headers.get("x-valid-rows") ?? 0);
  const invalidRows = Number(response.headers.get("x-invalid-rows") ?? 0);
  return {
    blob: await response.blob(),
    summary: {
      totalRows,
      validRows,
      invalidRows,
      filename: downloadFilename(response),
    },
  };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
