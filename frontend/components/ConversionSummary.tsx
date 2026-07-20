"use client";

import { CheckCircle2 } from "lucide-react";
import type { ConversionSummaryData } from "@/lib/types";

export function ConversionSummary({ summary }: { summary: ConversionSummaryData }) {
  return (
    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-emerald-900">
            Konversi Berhasil Dituntaskan!
          </h3>
          <p className="mt-0.5 truncate text-xs text-emerald-700 font-mono">
            {summary.filename}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-slate-200 bg-white p-2 text-center">
              <p className="text-sm font-bold text-slate-900 font-mono">{summary.totalRows.toLocaleString()}</p>
              <p className="text-[10px] uppercase text-slate-500 font-medium">Total Baris</p>
            </div>

            <div className="rounded-md border border-emerald-200 bg-white p-2 text-center">
              <p className="text-sm font-bold text-emerald-700 font-mono">{summary.validRows.toLocaleString()}</p>
              <p className="text-[10px] uppercase text-emerald-600 font-medium">Valid</p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-2 text-center">
              <p className={`text-sm font-bold font-mono ${summary.invalidRows > 0 ? "text-amber-600" : "text-slate-500"}`}>
                {summary.invalidRows.toLocaleString()}
              </p>
              <p className="text-[10px] uppercase text-slate-500 font-medium">Dilewati</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
