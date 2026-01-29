// app/cubicacion/simulaciones/SubmitButton.tsx
"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={[
        "rounded-lg px-4 py-2 text-white",
        pending ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700",
      ].join(" ")}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
          Creando…
        </span>
      ) : (
        "Nueva simulación"
      )}
    </button>
  );
}
