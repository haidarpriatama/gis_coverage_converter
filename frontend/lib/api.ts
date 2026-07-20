import type {
  ConversionRequest,
  ConversionSummaryData,
  CsvInspection,
  RequestProgress,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function inspectCsv(file: File): Promise<CsvInspection> {
  return inspectCsvWithProgress(file);
}

export async function convertCsv(
  file: File,
  request: ConversionRequest,
  options: {
    onUploadProgress?: (progress: RequestProgress) => void;
    onProcessingStart?: () => void;
  } = {},
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

  const response = await xhrBlob(`${API_BASE_URL}/api/convert`, formData, options);

  const totalRows = Number(response.headers["x-total-rows"] ?? 0);
  const validRows = Number(response.headers["x-valid-rows"] ?? 0);
  const invalidRows = Number(response.headers["x-invalid-rows"] ?? 0);
  const duplicateRows = Number(response.headers["x-duplicate-rows"] ?? 0);
  return {
    blob: response.blob,
    summary: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      filename: downloadFilenameFromHeader(response.headers["content-disposition"] ?? ""),
    },
  };
}

export async function inspectCsvWithProgress(
  file: File,
  onUploadProgress?: (progress: RequestProgress) => void,
  onProcessingStart?: () => void,
): Promise<CsvInspection> {
  const formData = new FormData();
  formData.append("file", file);
  return xhrJson<CsvInspection>(`${API_BASE_URL}/api/csv/inspect`, formData, {
    onUploadProgress,
    onProcessingStart,
  });
}

function downloadFilenameFromHeader(disposition: string): string {
  const utf8Match = disposition.match(/filename\*=utf-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];
  return "coverage_grid";
}

function headersFromXhr(xhr: XMLHttpRequest): Record<string, string> {
  return xhr
    .getAllResponseHeaders()
    .trim()
    .split(/[\r\n]+/)
    .filter(Boolean)
    .reduce<Record<string, string>>((headers, line) => {
      const separator = line.indexOf(":");
      if (separator > -1) {
        headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      }
      return headers;
    }, {});
}

function normalizeProgress(event: ProgressEvent): RequestProgress | null {
  if (!event.lengthComputable || event.total <= 0) return null;
  return {
    loaded: event.loaded,
    total: event.total,
    percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
  };
}

function xhrJson<T>(
  url: string,
  formData: FormData,
  options: {
    onUploadProgress?: (progress: RequestProgress) => void;
    onProcessingStart?: () => void;
  } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "text";
    xhr.upload.onprogress = (event) => {
      const progress = normalizeProgress(event);
      if (progress) options.onUploadProgress?.(progress);
    };
    xhr.upload.onload = () => options.onProcessingStart?.();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("The server returned an invalid JSON response."));
        }
        return;
      }
      reject(new Error(errorMessageFromText(xhr.responseText, xhr.status)));
    };
    xhr.onerror = () => reject(new Error("Network request failed."));
    xhr.send(formData);
  });
}

function xhrBlob(
  url: string,
  formData: FormData,
  options: {
    onUploadProgress?: (progress: RequestProgress) => void;
    onProcessingStart?: () => void;
  } = {},
): Promise<{ blob: Blob; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "blob";
    xhr.upload.onprogress = (event) => {
      const progress = normalizeProgress(event);
      if (progress) options.onUploadProgress?.(progress);
    };
    xhr.upload.onload = () => options.onProcessingStart?.();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ blob: xhr.response as Blob, headers: headersFromXhr(xhr) });
        return;
      }
      const responseBlob = xhr.response as Blob | null;
      if (!responseBlob) {
        reject(new Error(`Request failed with status ${xhr.status}.`));
        return;
      }
      responseBlob
        .text()
        .then((text) => reject(new Error(errorMessageFromText(text, xhr.status))))
        .catch(() => reject(new Error(`Request failed with status ${xhr.status}.`)));
    };
    xhr.onerror = () => reject(new Error("Network request failed."));
    xhr.send(formData);
  });
}

function errorMessageFromText(text: string, status: number): string {
  try {
    const payload = JSON.parse(text) as { detail?: string | Array<{ msg?: string }> };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // Fall back to status when the server did not return JSON.
  }
  return `Request failed with status ${status}.`;
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
