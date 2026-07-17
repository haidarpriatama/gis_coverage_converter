import { ConversionForm } from "@/components/ConversionForm";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-800 shadow-sm backdrop-blur">
            <span className="grid size-5 place-items-center rounded-md bg-teal-700 text-white">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="size-3" aria-hidden="true">
                <path d="M2.5 2.5h11v11h-11zM8 2.5v11M2.5 8h11" />
              </svg>
            </span>
            Spatial file utility
          </div>
          <h1 className="text-balance text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            CSV Coverage Grid Converter
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-600 sm:text-base">
            Turn longitude and latitude rows into precise, ready-to-use square polygons for Google Earth or QGIS.
          </p>
        </header>

        <ConversionForm />

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span>EPSG:4326 input</span>
          <span className="size-1 rounded-full bg-slate-300" />
          <span>UTM-based geometry</span>
          <span className="size-1 rounded-full bg-slate-300" />
          <span>Temporary processing only</span>
        </footer>
      </div>
    </main>
  );
}
