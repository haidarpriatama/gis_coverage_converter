import type { ConversionSummaryData } from "@/lib/types";

export function ConversionSummary({ summary }: { summary: ConversionSummaryData }) {
  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-emerald-950">Conversion complete</h2>
          <p className="mt-1 truncate text-sm text-emerald-800">Downloaded {summary.filename}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Total", summary.totalRows],
              ["Valid", summary.validRows],
              ["Skipped", summary.invalidRows],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-emerald-200/70">
                <p className="text-lg font-extrabold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label} rows</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
