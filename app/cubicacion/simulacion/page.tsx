import { crearSimulacion } from "@/app/cubicacion/actions/simulacionActions";
import { redirect } from "next/navigation";

export default function SimulacionesPage() {
  async function crear(formData: FormData) {
    "use server";

    const titulo = String(formData.get("titulo") || "").trim();
    const descripcion = String(formData.get("descripcion") || "").trim();

    if (!titulo) {
      throw new Error("El título es obligatorio");
    }

    const simulacion = await crearSimulacion({
      empresaId: 1, // luego se puede sacar del contexto del usuario
      titulo,
      descripcion,
    });

    redirect(`/cubicacion/simulacion/${simulacion.id}`);
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold">
        Simulaciones de cubicación
      </h1>

      <form action={crear} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Título
          </label>
          <input
            name="titulo"
            required
            placeholder="Ej: Simulación pallets enero"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            name="descripcion"
            rows={3}
            placeholder="Notas o contexto de la simulación"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Nueva simulación
        </button>
      </form>
    </div>
  );
}
