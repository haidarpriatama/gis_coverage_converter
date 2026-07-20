import { ConversionForm } from "@/components/ConversionForm";
import { Globe, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
              <Globe className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  GeoConvert
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                  Coverage Grid
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Konversi CSV ke Grid Polygon 153m</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:flex">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>Input: <strong className="font-semibold text-slate-900">EPSG:4326 WGS84</strong></span>
              <span className="text-slate-300">·</span>
              <span>Proyeksi UTM Otomatis</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
        <ConversionForm />
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4">
          CSV Coverage Grid Converter · Input EPSG:4326 · Grid 153m × 153m
        </div>
      </footer>
    </main>
  );
}
