export function Card({ title, value, meta }: { title: string; value: string | number; meta?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}

export function Badge({ value, tone }: { value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : tone === "bad"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{value}</span>;
}
