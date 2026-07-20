"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickCsvFromGoogleDrive, type DriveDownloadProgress } from "@/lib/google-drive";

interface GoogleDriveButtonProps {
  disabled: boolean;
  onFile: (file: File) => void | Promise<void>;
  onError: (message: string) => void;
  onProgress: (progress: DriveDownloadProgress) => void;
}

function GoogleDriveIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85L10.45 73.5C11.25 74.9 12.4 76 13.75 76.8L27.5 53H0C0 54.55 0.4 56.1 1.2 57.5L6.6 66.85Z" fill="#0066DA"/>
      <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5C0.4 49.9 0 51.45 0 53H27.5L43.65 25Z" fill="#00AC47"/>
      <path d="M73.55 76.8C74.9 76 76.05 74.9 76.85 73.5L83.5 62C84.3 60.6 84.7 59.05 84.7 57.5H57.2L73.55 76.8Z" fill="#EA4335"/>
      <path d="M43.65 25L57.4 1.2C56.05 0.4 54.5 0 52.95 0H34.35C32.8 0 31.25 0.4 29.9 1.2L43.65 25Z" fill="#00832D"/>
      <path d="M57.2 53H84.7C84.7 51.45 84.3 49.9 83.5 48.5L70.75 26.4C69.95 25 68.8 23.9 67.45 23.1L53.7 46.9L57.2 53Z" fill="#FFBA00"/>
    </svg>
  );
}

export function GoogleDriveButton({ disabled, onFile, onError, onProgress }: GoogleDriveButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || loading}
      className="h-9 w-full rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
      onClick={async () => {
        setLoading(true);
        try {
          const file = await pickCsvFromGoogleDrive(onProgress);
          if (file) await onFile(file);
        } catch (reason) {
          onError(reason instanceof Error ? reason.message : "File Google Drive tidak dapat diambil.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin text-slate-600" />
          Mengambil dari Drive...
        </>
      ) : (
        <>
          <GoogleDriveIcon className="size-3.5" />
          Pilih dari Google Drive
        </>
      )}
    </Button>
  );
}
