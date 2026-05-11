import { cn } from "@/lib/utils";

interface ConnectionStatusCardProps {
  statusText: string;
  hasError: boolean;
}

export function ConnectionStatusCard({ statusText, hasError }: ConnectionStatusCardProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-amber-300 sm:text-xs">
          Coldplay Chat
        </p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-amber-200 to-sky-200 bg-clip-text text-xl font-extrabold leading-tight tracking-tight text-transparent sm:text-2xl md:text-3xl 2xl:text-[2rem]">
          Everything Coldplay, one message away
        </h1>
      </div>
      <div
        role="status"
        aria-live="polite"
        className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-white/30 bg-slate-950/50 px-3 py-1.5 text-[0.7rem] text-slate-200 backdrop-blur-md sm:text-xs"
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            hasError
              ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.85)]"
              : "bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.85)]"
          )}
        />
        <span className="truncate">{statusText}</span>
      </div>
    </header>
  );
}
