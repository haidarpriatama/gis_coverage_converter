"use client";

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  disabled: boolean;
  converting: boolean;
}

export function DownloadButton({ disabled, converting }: DownloadButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className={`h-11 w-full rounded-md px-5 text-sm font-semibold transition-colors ${
        disabled
          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          : "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 cursor-pointer shadow-xs"
      }`}
    >
      {converting ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-white" />
          Memproses & Membuat Grid...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          Konversi & Unduh File Coverage Grid
          <Download className="size-4" />
        </span>
      )}
    </Button>
  );
}
