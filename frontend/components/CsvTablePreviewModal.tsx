"use client";

import { useState } from "react";
import { Eye, FileSpreadsheet, Info, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const PREVIEW_BYTES = 2 * 1024 * 1024;
const PREVIEW_ROWS = 100;

interface CsvTablePreviewModalProps {
  file: File | null;
  columns: string[];
}

function delimiterFromHeader(header: string): string {
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) =>
    header.split(candidate).length > header.split(best).length ? candidate : best,
  );
}

function parsePreview(text: string): string[][] {
  const delimiter = delimiterFromHeader(text.split(/\r?\n/, 1)[0] ?? "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length && records.length <= PREVIEW_ROWS; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      record.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  return records.slice(1, PREVIEW_ROWS + 1);
}

export function CsvTablePreviewModal({ file, columns }: CsvTablePreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!file) return null;

  async function openPreview() {
    setIsOpen(true);
    setLoading(true);
    setError(null);
    try {
      const text = await file!.slice(0, PREVIEW_BYTES).text();
      setRows(parsePreview(text));
    } catch {
      setRows([]);
      setError("Pratinjau CSV tidak dapat dibaca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openPreview}
        className="h-9 w-full rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Eye className="size-3.5 text-slate-500" />
        Pratinjau tabel
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">Pratinjau CSV</h3>
                  <p className="truncate text-xs text-slate-500">{file.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Tutup pratinjau"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-52 flex-1 overflow-auto p-5">
              {loading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="size-4 animate-spin" />
                  Membaca sampel data...
                </div>
              ) : error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center text-xs text-red-700">
                  {error}
                </div>
              ) : (
                <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 font-semibold text-slate-800">
                      <tr>
                        <th className="w-12 bg-slate-50 px-3 py-2.5 text-center text-slate-400">#</th>
                        {columns.map((column) => (
                          <th key={column} className="whitespace-nowrap border-l border-slate-200 bg-slate-50 px-3 py-2.5">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-slate-50">
                          <td className="bg-slate-50/50 px-3 py-2 text-center font-sans text-slate-400">
                            {rowIndex + 1}
                          </td>
                          {columns.map((column, columnIndex) => (
                            <td key={column} className="max-w-xs truncate whitespace-nowrap border-l border-slate-100 px-3 py-2">
                              {row[columnIndex] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0" />
                Maksimal {PREVIEW_ROWS} baris pertama ditampilkan agar file besar tetap ringan.
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="h-8 shrink-0 border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
