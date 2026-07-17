interface DownloadButtonProps {
  disabled: boolean;
  converting: boolean;
}

export function DownloadButton({ disabled, converting }: DownloadButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto sm:min-w-56"
    >
      {converting ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          Building your grids…
        </>
      ) : (
        <>
          Convert and download
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5" aria-hidden="true">
            <path d="M10 3v10m0 0 4-4m-4 4L6 9M4 16h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      )}
    </button>
  );
}
