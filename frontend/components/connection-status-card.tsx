import { cn } from "@/lib/utils";

interface ConnectionStatusCardProps {
  statusText: string;
  hasError: boolean;
}

export function ConnectionStatusCard({ statusText, hasError }: ConnectionStatusCardProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/65 sm:text-xs">
          Coldplay Chat
        </p>
        <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl md:text-3xl 2xl:text-[2rem]">
          Everything Coldplay, one message away
        </h1>
      </div>
      <div
        role="status"
        aria-live="polite"
        className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-white/30 bg-slate-950/45 px-3 py-1.5 text-[0.7rem] text-slate-100 backdrop-blur-md sm:text-xs"
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            hasError
              ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]"
              : "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]"
          )}
        />
        <span className="truncate">{statusText}</span>
      </div>
    </header>
  );
}
