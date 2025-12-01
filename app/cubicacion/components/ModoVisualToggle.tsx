// app/cubicacion/components/ModoVisualToggle.tsx
"use client";

export type ModoVisual = "real" | "real_sep" | "didactico";

interface Props {
  value: ModoVisual;
  onChange: (v: ModoVisual) => void;
}

export function ModoVisualToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/60 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("real")}
        className={`px-2 py-1 border-r border-slate-700 ${
          value === "real" ? "bg-slate-700 text-white" : "text-slate-300"
        }`}
      >
        Real
      </button>
      <button
        type="button"
        onClick={() => onChange("real_sep")}
        className={`px-2 py-1 border-r border-slate-700 ${
          value === "real_sep" ? "bg-slate-700 text-white" : "text-slate-300"
        }`}
      >
        Real + sep.
      </button>
      <button
        type="button"
        onClick={() => onChange("didactico")}
        className={`px-2 py-1 ${
          value === "didactico"
            ? "bg-slate-700 text-white"
            : "text-slate-300"
        }`}
      >
        Didáctico
      </button>
    </div>
  );
}
