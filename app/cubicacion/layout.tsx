// src/app/cubicacion/layout.tsx
import type { ReactNode } from "react";

export default function CubicacionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">
          Cubicación de productos
        </h1>
        <p className="text-sm text-slate-500">
          Definí producto, contenedor y simulá pallets.
        </p>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
