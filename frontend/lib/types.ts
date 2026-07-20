export type OutputFormat = "kml" | "gpkg";

export type UiStatus =
  | "initial"
  | "uploading"
  | "inspecting"
  | "ready"
  | "converting"
  | "download-ready"
  | "error";

export interface SuggestedColumns {
  longitude: string | null;
  latitude: string | null;
  name: string | null;
  category: string | null;
}

export interface CsvInspection {
  filename: string;
  columns: string[];
  total_rows: number;
  suggested_columns: SuggestedColumns;
}

export interface ConversionSummaryData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  filename: string;
}

export interface ConversionRequest {
  longitudeColumn: string;
  latitudeColumn: string;
  nameColumn?: string;
  categoryColumn?: string;
  outputFormat: OutputFormat;
}

export interface RequestProgress {
  loaded: number;
  total: number;
  percent: number;
}
