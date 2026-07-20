"use client";

import { useRef, useState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvUploaderProps {
  file: File | null;
  busy: boolean;
  compact?: boolean;
  onFile: (file: File) => void;
}

export function CsvUploader({ file, busy, compact = false, onFile }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <input
        id="csv-upload"
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Pilih file CSV dari perangkat"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (nextFile) onFile(nextFile);
          event.target.value = "";
        }}
      />

      {compact ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-9 w-full rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <UploadCloud className="size-3.5 text-slate-500" />
          Upload file lain
        </Button>
      ) : (
        <div
          onClick={() => !busy && inputRef.current?.click()}
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
          className={`group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-slate-900 bg-slate-50"
              : file
              ? "border-emerald-500/40 bg-emerald-50/30 hover:border-emerald-500/60"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
          } ${busy ? "cursor-wait opacity-50" : ""}`}
        >
          <div className={`mb-3 flex size-11 items-center justify-center rounded-lg border ${
            file 
              ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
              : "bg-slate-50 border-slate-200 text-slate-600 group-hover:border-slate-300"
          }`}>
            {file ? <CheckCircle2 className="size-5" /> : <UploadCloud className="size-5" />}
          </div>

          <h3 className="text-xs font-semibold text-slate-900 mb-1">
            {file ? "File CSV Siap Ditinjau" : "Unggah File CSV"}
          </h3>

          <p className="text-xs text-slate-500 max-w-xs mb-3">
            {file ? (
              <span className="text-emerald-700 font-medium">{file.name}</span>
            ) : (
              <>
                Tarik & lepas file di sini atau <span className="font-medium text-slate-900 underline underline-offset-2">pilih file</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600 border border-slate-200">.CSV</span>
            <span>·</span>
            <span>Maksimal 1 GB</span>
          </div>
        </div>
      )}
    </div>
  );
}
