interface ConnectionStatusCardProps {
  statusText: string;
  hasError: boolean;
}

export function ConnectionStatusCard({ statusText, hasError }: ConnectionStatusCardProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
          Coldplay Chat
        </p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-amber-200 to-sky-200 bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent md:text-3xl">
          Everything Coldplay, one message away
        </h1>
      </div>
      <div
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 self-start rounded-full border border-white/30 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-md"
      >
        <span
          className={
            hasError
              ? "h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.85)]"
              : "h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.85)]"
          }
        />
        {statusText}
      </div>
    </header>
  );
}
