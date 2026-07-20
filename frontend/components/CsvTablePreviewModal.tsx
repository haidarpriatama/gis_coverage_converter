"use client";

import { useState, useEffect } from "react";
import { X, Eye, FileSpreadsheet, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvTablePreviewModalProps {
  file: File | null;
  columns: string[];
}

export function CsvTablePreviewModal({ file, columns }: CsvTablePreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setRows([]);
          setLoading(false);
          return;
        }

        const firstLine = text.split("\n")[0] || "";
        let delimiter = ",";
        if (firstLine.includes(";")) delimiter = ";";
        else if (firstLine.includes("\t")) delimiter = "\t";

        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        // Skip header line, include all data lines
        const dataLines = lines.slice(1);

        const parsedRows = dataLines.map((line) => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        });

        setRows(parsedRows);
      } catch (err) {
        setError("Gagal membaca pratinjau CSV.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Gagal membaca file CSV.");
      setLoading(false);
    };

    // Read full file text for complete table preview
    reader.readAsText(file);
  }, [isOpen, file]);

  if (!file) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Eye className="size-3.5 text-slate-500" />
        Pratinjau Data Tabel
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    Pratinjau Data CSV
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 font-mono">
                      {rows.length.toLocaleString()} Baris Data
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-md">{file.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                aria-label="Tutup pratinjau"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="size-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent mb-2" />
                  <p className="text-xs">Membaca seluruh data CSV...</p>
                </div>
              ) : error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center text-xs text-red-700">
                  {error}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[55vh]">
                  <div className="overflow-auto max-h-[55vh]">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-800 uppercase tracking-wider font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2.5 w-12 text-slate-400 text-center bg-slate-50">#</th>
                          {columns.map((col, idx) => (
                            <th key={idx} className="px-3 py-2.5 border-l border-slate-200 whitespace-nowrap bg-slate-50">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 text-center font-sans font-medium bg-slate-50/50">
                              {rowIdx + 1}
                            </td>
                            {columns.map((_, colIdx) => (
                              <td key={colIdx} className="px-3 py-2 border-l border-slate-100 whitespace-nowrap max-w-xs truncate text-slate-800">
                                {row[colIdx] !== undefined ? row[colIdx] : "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Info className="size-3.5 text-slate-400" />
                Gunakan tabel untuk memeriksa semua baris data CSV Anda.
              </span>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="h-8 bg-white border-slate-200 text-slate-700 hover:bg-slate-100 text-xs px-3"
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
