"use client";

import { useRef, useState } from "react";

interface CsvUploaderProps {
  file: File | null;
  busy: boolean;
  onFile: (file: File) => void;
}

export function CsvUploader({ file, busy, onFile }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (nextFile) onFile(nextFile);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        aria-label="Choose CSV file"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const nextFile = event.dataTransfer.files?.[0];
          if (nextFile) onFile(nextFile);
        }}
        className={`group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition sm:py-12 ${
          dragging
            ? "border-teal-500 bg-teal-50"
            : "border-slate-300 bg-slate-50/60 hover:border-teal-400 hover:bg-teal-50/50"
        } disabled:cursor-wait disabled:opacity-60`}
      >
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-sm font-semibold text-slate-900">
          {file ? "Choose a different CSV" : "Drop your CSV here"}
        </span>
        <span className="mt-1.5 text-sm text-slate-500">
          or <span className="font-medium text-teal-700">browse files</span> · up to 50 MB
        </span>
      </button>
    </div>
  );
}
